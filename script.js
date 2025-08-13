// --- START OF FILE script.js ---

/*************************************************/
/*          APP CONFIGURATION & GLOBALS          */
/*************************************************/
// This URL should point to your deployed Google Apps Script.
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbygwK2ytrtCXV3v2oi-2Ewy87tLt9o6AAqTaTeNHcli6a4APbaRvXAc3d4sIdDLSTOi/exec";

// App State
let currentUser = null;
let itemDatabase = [];
let userRequests = []; // For storing requests relevant to the logged-in user
let autocompleteDebounceTimer;
let notificationPoller;

// Chart instances
let statusChart = null;
let branchChart = null;

// Variables to remember values from the calculator
let lastUsedUnitCount = 1;
let lastUsedDiscount = 0;
let lastUsedVat = 0;


/*************************************************/
/*         INITIALIZATION & LOGIN FLOW           */
/*************************************************/
$(document).ready(function() {
    // Check if user data is in session storage
    const storedUser = sessionStorage.getItem('priceAppUser');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        showDashboard();
    } else {
        $('#login-view').show();
    }

    // Add event listener for password field to allow login on Enter key
    $('#password').on('keypress', function(e) {
        if (e.which === 13) { // Enter key
            handleLogin();
        }
    });
});

async function handleLogin() {
    const username = $('#username').val().trim();
    const password = $('#password').val();
    if (!username || !password) {
        $('#login-error').text('Username and password are required.');
        return;
    }

    showLoader('Logging in...');
    try {
        const response = await apiCall('login', { username, password });
        currentUser = response;
        sessionStorage.setItem('priceAppUser', JSON.stringify(currentUser));
        $('#login-error').text('');
        $('#login-view').hide();
        showDashboard();
    } catch (error) {
        $('#login-error').text(error.message);
    } finally {
        hideLoader();
    }
}

function logout() {
    currentUser = null;
    sessionStorage.removeItem('priceAppUser');
    clearInterval(notificationPoller);
    
    // Hide all main views and show login
    $('#main-app-view').hide();
    $('#branch-user-dashboard').hide();
    $('#officer-dashboard').hide();
    $('#login-view').show();
    
    // Clear login form
    $('#username').val('');
    $('#password').val('');
}

function showDashboard() {
    $('#welcome-message').text(`Welcome, ${currentUser.username}`);
    $('#user-role-badge').text(currentUser.role).addClass(currentUser.role === 'Officer' ? 'badge-success' : 'badge-primary');
    $('#main-app-view').show();

    if (currentUser.role === 'Officer') {
        $('#officer-dashboard').show();
        fetchInitialData();
    } else { // Branch User
        $('#branch-user-dashboard').show();
        injectRequestForm();
        fetchInitialData();
    }
    loadItemDatabase();

    // Start polling for notifications
    notificationPoller = setInterval(fetchInitialData, 30000); // Poll every 30 seconds
}

async function fetchInitialData() {
    try {
        const response = await apiCall('getInitialData', { user: currentUser });
        const oldRequestCount = userRequests.length;
        userRequests = response.requests;

        // Check for notifications
        if (userRequests.length > oldRequestCount && oldRequestCount > 0) {
            const message = currentUser.role === 'Officer' ? 'New pending request received!' : 'A request has been updated!';
            showNotification(message, true);
        }

        // Render relevant views
        if (currentUser.role === 'Officer') {
            renderPendingRequestsTable();
            $('#pending-count-badge').text(userRequests.length > 0 ? userRequests.length : '');
        } else {
            renderMyRequestsTable();
        }

    } catch (error) {
        displayMessage(`Error fetching initial data: ${error.message}`, true);
    }
}


/*************************************************/
/*        BRANCH USER DASHBOARD FUNCTIONS        */
/*************************************************/
function injectRequestForm() {
    const formHtml = `
        <div class="form-row">
            <div class="form-group col-md-6" style="position: relative;">
                <label for="code">Code:</label>
                <input type="text" class="form-control" id="code" oninput="handleCodeInput()">
                <div id="autocomplete-suggestions"></div>
                <div id="codeError" class="error-message"></div>
            </div>
            <div class="form-group col-md-6">
                <label for="type">Type:</label>
                <select class="form-control" id="type" onchange="toggleCurrentPriceField()">
                    <option value="شراء">شراء</option>
                    <option value="مرتجع">مرتجع</option>
                </select>
            </div>
        </div>
        <div class="form-group" id="currentPriceDiv" style="display:none;">
            <label for="currentPrice">Current Price:</label>
            <input type="number" step="0.001" class="form-control" id="currentPrice">
            <div id="currentPriceError" class="error-message"></div>
        </div>
        <div class="form-group"><label for="name">Name:</label><input type="text" class="form-control" id="name" readonly></div>
        <div class="form-group"><label for="supplierName">Supplier:</label><input type="text" class="form-control" id="supplierName" readonly></div>
        <div class="form-group">
            <label for="unitPrice">Final Unit Price:</label>
            <div class="input-group">
                <input type="number" step="0.001" class="form-control" id="unitPrice">
                <div class="input-group-append">
                    <button class="btn btn-outline-secondary" type="button" onclick="openCalculatorModal()">
                        <i class="fas fa-calculator"></i>
                    </button>
                </div>
            </div>
            <div id="unitPriceError" class="error-message"></div>
        </div>
        <button class="btn btn-primary" onclick="submitRequest()"><i class="fas fa-paper-plane"></i> Submit Request</button>
    `;
    $('#request-form-container').html(formHtml);
}

function renderMyRequestsTable() {
    const tbody = $('#my-requests-tbody');
    tbody.empty();
    if (userRequests.length === 0) {
        tbody.append('<tr><td colspan="6" class="text-center">You have not submitted any requests.</td></tr>');
        return;
    }
    userRequests.forEach(req => {
        const statusBadge = `<span class="badge badge-pill ${getStatusColor(req.status)}">${req.status}</span>`;
        const row = `
            <tr data-request-id="${req.requestid}">
                <td>${req.requestid}</td>
                <td>${req.itemcode}</td>
                <td>${req.itemname}</td>
                <td>${req.creationtimestamp}</td>
                <td>${statusBadge}</td>
                <td><button class="btn btn-info btn-sm" onclick="openReviewModal('${req.requestid}')"><i class="fas fa-eye"></i> View</button></td>
            </tr>
        `;
        tbody.append(row);
    });
}

async function submitRequest() {
    if (!validateRequestForm()) return;

    const newEntry = {
        code: $('#code').val(),
        name: $('#name').val(),
        supplier: $('#supplierName').val(),
        units: lastUsedUnitCount,
        discount: lastUsedDiscount,
        vat: lastUsedVat,
        piece: parseFloat($('#unitPrice').val()).toFixed(3),
        case: (parseFloat($('#unitPrice').val()) * lastUsedUnitCount).toFixed(3),
        type: $('#type').val(),
        current: $('#type').val() === 'مرتجع' ? parseFloat($('#currentPrice').val()).toFixed(3) : ''
    };
    
    showLoader('Submitting request...');
    try {
        await apiCall('submitRequest', { user: currentUser, entry: newEntry });
        displayMessage('Request submitted successfully!', false);
        clearInputFields();
        fetchInitialData(); // Refresh the list
    } catch (error) {
        displayMessage(`Error: ${error.message}`, true);
    } finally {
        hideLoader();
    }
}


/*************************************************/
/*          OFFICER DASHBOARD FUNCTIONS          */
/*************************************************/
function renderPendingRequestsTable() {
    const tbody = $('#pending-requests-tbody');
    tbody.empty();
    const pending = userRequests.filter(r => r.status === 'Pending');
    if (pending.length === 0) {
        tbody.append('<tr><td colspan="6" class="text-center">No pending requests.</td></tr>');
        return;
    }
    pending.forEach(req => {
        const row = `
            <tr data-request-id="${req.requestid}">
                <td>${req.requestid}</td>
                <td>${req.branch}</td>
                <td>${req.username}</td>
                <td>${req.itemcode}</td>
                <td>${req.creationtimestamp}</td>
                <td><button class="btn btn-primary btn-sm" onclick="openReviewModal('${req.requestid}')"><i class="fas fa-search"></i> Review</button></td>
            </tr>
        `;
        tbody.append(row);
    });
}

async function handleUpdateRequest() {
    const updateData = {
        requestID: $('#hidden-request-id').val(),
        newStatus: $('#update-status').val(),
        notes: $('#officer-notes').val().trim()
    };
    
    showLoader('Updating status...');
    try {
        await apiCall('updateRequestStatus', { user: currentUser, updateData });
        displayMessage('Request updated successfully!', false);
        $('#reviewRequestModal').modal('hide');
        fetchInitialData(); // Refresh list
    } catch (error) {
        displayMessage(`Error: ${error.message}`, true);
    } finally {
        hideLoader();
    }
}

async function fetchAndRenderReports() {
    const filters = {
        startDate: $('#filter-start-date').val(),
        endDate: $('#filter-end-date').val(),
        branch: $('#filter-branch').val(),
        status: $('#filter-status').val(),
    };
    
    showLoader('Generating reports...');
    try {
        const reportData = await apiCall('getReportData', { user: currentUser, filters });
        
        // KPIs
        $('#kpi-total-requests').text(reportData.kpis.totalRequests);
        $('#kpi-pending-requests').text(reportData.kpis.pendingRequests);

        // Charts
        renderStatusChart(reportData.charts.statusCounts);
        renderBranchChart(reportData.charts.branchCounts);
        
        // Supplier Table
        const supplierTbody = $('#supplier-report-tbody');
        supplierTbody.empty();
        reportData.charts.supplierReport.forEach(s => {
            supplierTbody.append(`<tr><td>${s.supplier}</td><td>${s.total}</td><td>${s.pending}</td></tr>`);
        });

    } catch (error) {
        displayMessage(`Error fetching report data: ${error.message}`, true);
    } finally {
        hideLoader();
    }
}

function renderStatusChart(data) {
    if (statusChart) statusChart.destroy();
    const ctx = document.getElementById('status-chart').getContext('2d');
    statusChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(data),
            datasets: [{
                data: Object.values(data),
                backgroundColor: Object.keys(data).map(status => getStatusColor(status, true))
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Requests by Status' } } }
    });
}

function renderBranchChart(data) {
    if (branchChart) branchChart.destroy();
    const ctx = document.getElementById('branch-chart').getContext('2d');
    branchChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(data),
            datasets: [{
                label: 'Number of Requests',
                data: Object.values(data),
                backgroundColor: '#007bff'
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false }, title: { display: true, text: 'Requests by Branch' } } }
    });
}


/*************************************************/
/*             MODAL & POPUP LOGIC               */
/*************************************************/
async function openReviewModal(requestID) {
    // We need to fetch ALL requests to find the one we need, as userRequests might just be pending ones for officers
    showLoader('Loading request details...');
    try {
        const allRequestsResponse = await apiCall('getReportData', { user: currentUser, filters: {} });
        const request = allRequestsResponse.tableData.find(r => r.requestid === requestID);
        hideLoader();
        
        if (!request) {
            displayMessage('Could not find request details.', true);
            return;
        }

        $('#review-request-id').text(requestID);
        const content = `
            <div class="row">
                <div class="col-md-6">
                    <strong>Requester:</strong> ${request.username} (${request.branch})<br>
                    <strong>Sent On:</strong> ${request.creationtimestamp}<br>
                    <strong>Status:</strong> <span class="badge badge-pill ${getStatusColor(request.status)}">${request.status}</span><br>
                </div>
                <div class="col-md-6">
                    <strong>Item Code:</strong> ${request.itemcode}<br>
                    <strong>Item Name:</strong> ${request.itemname}<br>
                    <strong>Supplier:</strong> ${request.supplier}<br>
                </div>
            </div>
            <hr>
            <h5>Pricing Details</h5>
            <div class="row">
                <div class="col-md-4"><strong>Type:</strong> ${request.requesttype}</div>
                <div class="col-md-4"><strong>Requested Unit Price:</strong> ${request.pieceprice}</div>
                <div class="col-md-4"><strong>Requested Case Price:</strong> ${request.caseprice}</div>
                ${request.requesttype === 'مرتجع' ? `<div class="col-md-4"><strong>Current Price:</strong> ${request.currentprice}</div>` : ''}
            </div>
            <hr>
            <h5>Officer Review</h5>
            <p><strong>Officer:</strong> ${request.officername || 'N/A'}</p>
            <p><strong>Resolved On:</strong> ${request.resolutiontimestamp || 'N/A'}</p>
            <p><strong>Response Time:</strong> ${request.responsetime || 'N/A'}</p>
            <p><strong>Notes:</strong><br><pre>${request.officernotes || 'No notes.'}</pre></p>
        `;
        $('#review-modal-content').html(content);

        // Show officer actions only if user is an officer AND request is pending
        if (currentUser.role === 'Officer' && request.status === 'Pending') {
            $('#officer-action-form').show();
            $('#submit-update-btn').show();
            $('#hidden-request-id').val(requestID);
        } else {
            $('#officer-action-form').hide();
            $('#submit-update-btn').hide();
        }

        $('#reviewRequestModal').modal('show');

    } catch (error) {
        hideLoader();
        displayMessage(`Error loading details: ${error.message}`, true);
    }
}


/*************************************************/
/*              UI & HELPER FUNCTIONS            */
/*************************************************/
// --- API Call Wrapper ---
async function apiCall(action, data = {}) {
    if (!GAS_WEB_APP_URL || GAS_WEB_APP_URL.includes("PASTE_YOUR")) {
        throw new Error("API URL is not configured in script.js.");
    }
    const response = await fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, data })
    });

    if (!response.ok) throw new Error(`Network error: ${response.statusText}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'An unknown API error occurred.');
    return result.data;
}

// --- Loaders and Messages ---
function showLoader(text = 'Loading...') {
    $('#loading-text').text(text);
    $('#loading-overlay').css('display', 'flex');
}

function hideLoader() {
    $('#loading-overlay').hide();
}

function displayMessage(message, isError = false) {
    const container = $('#message-container');
    container.text(message).removeClass('error success').addClass(isError ? 'error' : 'success').addClass('show');
    setTimeout(() => container.removeClass('show'), 4000);
}

function showNotification(message, playSound = false) {
    displayMessage(message, false);
    if (playSound) {
        $('#notification-sound')[0].play().catch(e => console.warn("Audio play failed:", e));
    }
}

// --- Form & Field Helpers ---
async function loadItemDatabase() {
    try {
        itemDatabase = await apiCall('getItemDatabase');
    } catch (error) {
        displayMessage(`Failed to load item database: ${error.message}`, true);
    }
}

function handleCodeInput() {
    clearTimeout(autocompleteDebounceTimer);
    autocompleteDebounceTimer = setTimeout(() => {
        const codeInput = $('#code');
        const suggestionsBox = $('#autocomplete-suggestions');
        const term = codeInput.val().trim().toLowerCase();
        getItemDetails();
        if (term.length < 2) { suggestionsBox.hide(); return; }
        
        const suggestions = itemDatabase
            .filter(item => String(item.code).toLowerCase().includes(term) || String(item.name).toLowerCase().includes(term))
            .slice(0, 10);

        if (suggestions.length > 0) {
            suggestionsBox.html(suggestions.map(s =>
                `<div class="suggestion-item" onclick="selectAutocompleteItem('${s.code}')">
                    <strong>${s.code}</strong> - ${s.name}
                </div>`
            ).join('')).show();
        } else {
            suggestionsBox.hide();
        }
    }, 250);
}

function selectAutocompleteItem(code) {
    $('#code').val(code);
    $('#autocomplete-suggestions').hide();
    getItemDetails();
    $('#unitPrice').focus();
}

function getItemDetails() {
    const code = $('#code').val().trim();
    $('#name').val('');
    $('#supplierName').val('');
    if (!code) return;

    const foundItem = itemDatabase.find(item => String(item.code) === code);
    if (foundItem) {
        $('#name').val(foundItem.name || '');
        $('#supplierName').val(foundItem['supplier name'] || '');
    }
}

function toggleCurrentPriceField() {
    $('#currentPriceDiv').css('display', $('#type').val() === 'مرتجع' ? 'flex' : 'none');
}

function clearInputFields() {
    $('#code, #name, #supplierName, #unitPrice, #currentPrice').val('');
    $('#type').val('شراء');
    toggleCurrentPriceField();
    lastUsedUnitCount = 1;
    lastUsedDiscount = 0;
    lastUsedVat = 0;
    $('.error-message').text('');
    $('#code').focus();
}

function validateRequestForm() {
    let isValid = true;
    $('.error-message').text('');
    
    if (!$('#code').val()) { $('#codeError').text('Code is required.'); isValid = false; }
    const unitPrice = $('#unitPrice').val();
    if (unitPrice === '' || isNaN(parseFloat(unitPrice)) || parseFloat(unitPrice) < 0) {
        $('#unitPriceError').text('Valid unit price is required.'); isValid = false;
    }
    if ($('#type').val() === 'مرتجع') {
        const currentPrice = $('#currentPrice').val();
        if (currentPrice === '' || isNaN(parseFloat(currentPrice)) || parseFloat(currentPrice) < 0) {
            $('#currentPriceError').text('Valid current price required for returns.'); isValid = false;
        }
    }
    if (!isValid) displayMessage('Please correct errors before submitting.', true);
    return isValid;
}


// --- Calculator Modal Logic (Unchanged but adapted for jQuery) ---
function openCalculatorModal() {
    $('#modalCost').val('');
    $('#modalUnit').val('1');
    $('#modalDiscount').val('0');
    $('#modalVat').val('0');
    calculateInModal();
    $('#calculatorModal').modal('show');
}

function calculateInModal() {
    const cost = parseFloat($('#modalCost').val()) || 0;
    const unit = parseInt($('#modalUnit').val()) || 1;
    const discount = parseFloat($('#modalDiscount').val()) || 0;
    const vatRate = parseFloat($('#modalVat').val()) || 0;

    if (cost < 0 || unit <= 0 || discount < 0) {
        $('#modalUnitPriceResult, #modalCasePriceResult').val('Invalid Input');
        return;
    }
    const discountedCost = cost * (1 - discount / 100);
    const finalCasePrice = discountedCost * (1 + vatRate / 100);
    const finalUnitPrice = (unit > 0) ? (finalCasePrice / unit) : 0;

    $('#modalUnitPriceResult').val(finalUnitPrice.toFixed(3));
    $('#modalCasePriceResult').val(finalCasePrice.toFixed(3));
}

function applyCalculatorPrice() {
    lastUsedUnitCount = parseInt($('#modalUnit').val()) || 1;
    lastUsedDiscount = parseFloat($('#modalDiscount').val()) || 0;
    lastUsedVat = parseFloat($('#modalVat').val()) || 0;
    $('#unitPrice').val($('#modalUnitPriceResult').val());
    $('#calculatorModal').modal('hide');
}


function getStatusColor(status, forChart = false) {
    const colorMap = {
        'Pending': '#ffc107', // warning
        'تم التعديل': '#28a745', // success
        'تم التعديل جزئيا': '#17a2b8', // info
        'غير مسموع بالتعديل ويتم رفع الصنف': '#dc3545', // danger
        'يرجي مراجعة كود الاستثناء': '#fd7e14', // orange
        'يتم المراجعة مع المورد': '#6c757d', // secondary
    };
    if (forChart) return colorMap[status] || '#cccccc';

    const classMap = {
        'Pending': 'badge-warning',
        'تم التعديل': 'badge-success',
        'تم التعديل جزئيا': 'badge-info',
        'غير مسموع بالتعديل ويتم رفع الصنف': 'badge-danger',
        'يرجي مراجعة كود الاستثناء': 'badge-orange',
        'يتم المراجعة مع المورد': 'badge-secondary',
    };
    return classMap[status] || 'badge-light';
}
