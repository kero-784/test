/*************************************************/
/*          APP CONFIGURATION & GLOBALS          */
/*************************************************/
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbztbfLtY1H-ZdDRsh93LjGXjCWij9I_qaO13MCNoJLX8jHOieCC3oUVrII1RiUZGw1M/exec"; // PASTE YOUR NEW URL HERE
let masterItemDatabase = [];
let currentUser = null;
let autocompleteDebounceTimer;
let notificationInterval;
let lastNotificationCheck = new Date().toISOString();

/*************************************************/
/*     API COMMUNICATION LAYER                   */
/*************************************************/
async function apiRequest(method, action, data = {}) {
    const loadingIndicator = document.getElementById('loading-indicator');
    loadingIndicator.style.display = 'flex';
    try {
        let url = `${GAS_WEB_APP_URL}?action=${action}`;
        const options = { method: method, headers: { 'Content-Type': 'application/json' } };
        if (method === 'GET') {
            if (currentUser) data.user = JSON.stringify(currentUser);
            url += '&' + new URLSearchParams(data).toString();
        } else {
            if (currentUser) data.user = currentUser;
            options.body = JSON.stringify(data);
            options.mode = 'no-cors'; 
        }
        if (method === 'POST') {
             await fetch(url, options);
             return { success: true, message: 'Action submitted. Refreshing data...' };
        } else {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`Network error: ${response.statusText}`);
            return await response.json();
        }
    } catch (error) {
        console.error(`API Error (${action}):`, error);
        displayMessage(error.message, true);
        return { success: false, error: error.message };
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

/*************************************************/
/*     AUTHENTICATION & INITIALIZATION           */
/*************************************************/
function setupLoginListeners() {
    // UPDATED: Listens for the form submission event
    document.getElementById('login-form').addEventListener('submit', handleLogin);
}

// UPDATED: Accepts an 'event' object to prevent form submission
async function handleLogin(event) {
    if (event) event.preventDefault(); // This is crucial to stop the page from reloading

    const loginCode = document.getElementById('loginCode').value.trim();
    if (!loginCode) {
        showLoginError("Login Code is required.");
        return;
    }
    
    const loadingIndicator = document.getElementById('loading-indicator');
    loadingIndicator.style.display = 'flex';
    try {
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'login', loginCode: loginCode })
        });
        const result = await response.json();
        if (result.success) {
            currentUser = result.user;
            sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
            initializeApp();
        } else {
            showLoginError(result.error || "Login failed.");
        }
    } catch(e) {
        showLoginError("An error occurred during login.");
        console.error(e);
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

function showLoginError(message) {
    const errorDiv = document.getElementById('login-error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function handleLogout() {
    currentUser = null;
    sessionStorage.removeItem('currentUser');
    clearInterval(notificationInterval);
    document.getElementById('loginCode').value = '';
    showView('login-view');
}

async function initializeApp() {
    showView('main-view');
    document.getElementById('welcome-message').textContent = `Welcome, ${currentUser.DisplayName} (${currentUser.Role})`;
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    const dbResult = await apiRequest('GET', 'getItemDatabase');
    if (dbResult.success) masterItemDatabase = dbResult.data;
    if (currentUser.Role === 'Branch') {
        document.getElementById('branch-user-content').style.display = 'block';
        document.getElementById('officer-content').style.display = 'none';
        loadBranchUserData();
    } else if (currentUser.Role === 'Officer') {
        document.getElementById('branch-user-content').style.display = 'none';
        document.getElementById('officer-content').style.display = 'block';
        loadOfficerData();
    }
    startNotificationPolling();
}

/*************************************************/
/*     ROLE-SPECIFIC DATA LOADING                */
/*************************************************/
async function loadBranchUserData() {
    const result = await apiRequest('GET', 'getRequests');
    if (result.success) renderBranchRequests(result.data);
}

async function loadOfficerData() {
    const result = await apiRequest('GET', 'getRequests');
    if (result.success) renderOfficerRequests(result.data);
}

function renderBranchRequests(requests) {
    const tbody = document.getElementById('branch-requests-table');
    if (!requests || requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No requests found.</td></tr>';
        return;
    }
    tbody.innerHTML = requests.map(r => `
        <tr>
            <td>${r.RequestID}</td>
            <td>${new Date(r.SubmissionTimestamp).toLocaleDateString()}</td>
            <td>${r.ItemCode} - ${r.ItemName}</td>
            <td><span class="badge ${getStatusClass(r.Status)}">${r.Status}</span></td>
            <td>${r.OfficerNotes || 'N/A'}</td>
        </tr>
    `).join('');
}

function renderOfficerRequests(requests) {
    const tbody = document.getElementById('officer-requests-table');
    if (!requests || requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No requests found.</td></tr>';
        return;
    }
    tbody.innerHTML = requests.map(r => `
        <tr class="${r.Status === 'Pending' ? 'table-warning' : ''}">
            <td>${r.RequestID}</td>
            <td>${new Date(r.SubmissionTimestamp).toLocaleDateString()}</td>
            <td>${r.Branch}</td>
            <td>${r.SubmittedBy}</td>
            <td>${r.ItemCode} - ${r.ItemName}</td>
            <td><span class="badge ${getStatusClass(r.Status)}">${r.Status}</span></td>
            <td>
                <button class="btn btn-sm btn-primary" onclick='reviewRequest(${JSON.stringify(r)})'>
                    <i class="fas fa-search"></i> Review
                </button>
            </td>
        </tr>
    `).join('');
}

/*************************************************/
/*     UI LOGIC & EVENT HANDLERS                 */
/*************************************************/
function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.getElementById(viewId).style.display = 'block';
}

function handleCodeInput() {
    clearTimeout(autocompleteDebounceTimer);
    autocompleteDebounceTimer = setTimeout(() => {
        const codeInput = document.getElementById('code');
        const suggestionsBox = document.getElementById('autocomplete-suggestions');
        const term = codeInput.value.trim().toLowerCase();
        getItemDetails();
        if (term.length < 1) {
            suggestionsBox.style.display = 'none';
            return;
        }
        const suggestions = masterItemDatabase
            .filter(item => String(item.code).toLowerCase().includes(term) || String(item.name).toLowerCase().includes(term))
            .slice(0, 10);
        if (suggestions.length > 0) {
            suggestionsBox.innerHTML = suggestions.map(s =>
                `<div class="autocomplete-item" onclick="selectAutocompleteItem('${s.code}')">
                    <strong>${s.code}</strong> - ${s.name}
                </div>`
            ).join('');
            suggestionsBox.style.display = 'block';
        } else {
            suggestionsBox.style.display = 'none';
        }
    }, 250);
}

function selectAutocompleteItem(code) {
    document.getElementById('code').value = code;
    document.getElementById('autocomplete-suggestions').style.display = 'none';
    getItemDetails();
    document.getElementById('unitPrice').focus();
}

function getItemDetails() {
    const code = document.getElementById('code').value.trim();
    const nameField = document.getElementById('name');
    const supplierField = document.getElementById('supplierName');
    nameField.value = '';
    supplierField.value = '';
    if (!code) return;
    const foundItem = masterItemDatabase.find(item => String(item.code) === code);
    if (foundItem) {
        nameField.value = foundItem.name || '';
        supplierField.value = foundItem['supplier name'] || '';
    }
}

function toggleCurrentPriceField() {
    document.getElementById('currentPriceDiv').style.display = document.getElementById('type').value === 'مرتجع' ? 'block' : 'none';
}

async function submitRequest() {
    const code = document.getElementById('code').value.trim();
    const unitPrice = document.getElementById('unitPrice').value;
    if (!code || !unitPrice) {
        displayMessage("Code and New Unit Price are required.", true);
        return;
    }
    const foundItem = masterItemDatabase.find(item => String(item.code) === code);
    if (!foundItem) {
        displayMessage("Item code not found in the database.", true);
        return;
    }
    const requestData = {
        code: code,
        name: foundItem.name,
        supplier: foundItem['supplier name'],
        piece: parseFloat(unitPrice).toFixed(3),
        type: document.getElementById('type').value,
        current: document.getElementById('currentPrice').value || '0'
    };
    const result = await apiRequest('POST', 'submitRequest', { data: requestData });
    if (result.success) {
        displayMessage('Request submitted successfully!');
        clearRequestForm();
        loadBranchUserData();
    }
}

function clearRequestForm() {
    document.getElementById('code').value = '';
    document.getElementById('name').value = '';
    document.getElementById('supplierName').value = '';
    document.getElementById('unitPrice').value = '';
    document.getElementById('currentPrice').value = '';
    toggleCurrentPriceField();
}

function reviewRequest(request) {
    const detailsDiv = document.getElementById('modal-request-details');
    detailsDiv.innerHTML = `
        <p><strong>Branch:</strong> ${request.Branch}</p>
        <p><strong>Submitted By:</strong> ${request.SubmittedBy}</p>
        <p><strong>Item Code:</strong> ${request.ItemCode}</p>
        <p><strong>Item Name:</strong> ${request.ItemName}</p>
        <p><strong>Supplier:</strong> ${request.SubmittedSupplier}</p>
        <p><strong>Request Type:</strong> ${request.Type}</p>
        <p><strong>Requested New Unit Price:</strong> <span class="badge badge-info">${request.SubmittedUnitPrice}</span></p>
        ${request.Type === 'مرتجع' ? `<p><strong>Submitted Current Price:</strong> <span class="badge badge-warning">${request.SubmittedCurrentPrice}</span></p>` : ''}
    `;
    $('#request-details-modal').data('requestId', request.RequestID);
    $('#request-details-modal').modal('show');
}

async function confirmStatusUpdate() {
    const requestId = $('#request-details-modal').data('requestId');
    const newStatus = document.getElementById('modal-status-select').value;
    const result = await apiRequest('POST', 'updateRequestStatus', { data: { requestId, newStatus } });
    if (result.success) {
        displayMessage('Status updated successfully!');
        $('#request-details-modal').modal('hide');
        loadOfficerData();
    }
}

/*************************************************/
/*             NOTIFICATION SYSTEM               */
/*************************************************/
function startNotificationPolling() {
    notificationInterval = setInterval(async () => {
        const result = await apiRequest('GET', 'checkForNotifications', { lastCheck: lastNotificationCheck });
        if (result.success && result.data.newEvents.length > 0) {
            lastNotificationCheck = new Date().toISOString();
            const message = result.data.newEvents.join('\n');
            displayMessage(message, false, 10000);
            document.getElementById('notification-sound').play().catch(e => console.warn("Audio playback failed. This can happen if the user hasn't interacted with the page yet.", e));
            if (currentUser.Role === 'Branch') loadBranchUserData();
            else if (currentUser.Role === 'Officer') loadOfficerData();
        } else if(result.success) {
             lastNotificationCheck = new Date().toISOString();
        }
    }, 30000);
}

/*************************************************/
/*             REPORTING                         */
/*************************************************/
function showReportsView() { showView('reports-view'); }
function hideReportsView() { showView('main-view'); }

async function generateReport() {
    const filters = {
        startDate: document.getElementById('report-start-date').value,
        endDate: document.getElementById('report-end-date').value,
        status: document.getElementById('report-status').value,
        supplier: document.getElementById('report-supplier').value.trim()
    };
    const result = await apiRequest('GET', 'getReportData', { filters: JSON.stringify(filters) });
    if(result.success) renderReportResults(result.data);
}

function renderReportResults(data) {
    const tbody = document.getElementById('report-results-table');
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No matching records found.</td></tr>';
        document.getElementById('report-total-records').textContent = 0;
        document.getElementById('report-avg-response').textContent = 'N/A';
        return;
    }
    tbody.innerHTML = data.map(r => `
        <tr>
            <td>${r.RequestID}</td>
            <td>${new Date(r.SubmissionTimestamp).toLocaleString()}</td>
            <td>${r.Branch}</td>
            <td>${r.ItemCode}</td>
            <td>${r.SubmittedSupplier}</td>
            <td>${r.SubmittedUnitPrice}</td>
            <td><span class="badge ${getStatusClass(r.Status)}">${r.Status}</span></td>
            <td>${r.ResponseTimeHours || 'N/A'}</td>
        </tr>
    `).join('');
    document.getElementById('report-total-records').textContent = data.length;
    const resolvedRequests = data.filter(r => r.ResponseTimeHours);
    if(resolvedRequests.length > 0) {
        const totalHours = resolvedRequests.reduce((sum, r) => sum + parseFloat(r.ResponseTimeHours), 0);
        const avgHours = (totalHours / resolvedRequests.length).toFixed(2);
        document.getElementById('report-avg-response').textContent = `${avgHours}`;
    } else {
        document.getElementById('report-avg-response').textContent = 'N/A';
    }
}

/*************************************************/
/*      UTILITY & HELPER FUNCTIONS               */
/*************************************************/
function displayMessage(message, isError = false, duration = 3000) {
    const messageContainer = document.getElementById('message-container');
    messageContainer.textContent = message;
    messageContainer.className = isError ? 'error show' : 'success show';
    setTimeout(() => { messageContainer.classList.remove('show'); }, duration);
}

function getStatusClass(status) {
    switch(status) {
        case 'Pending': return 'badge-secondary';
        case 'تم التعديل': case 'تم التعديل جزئيا': return 'badge-success';
        case 'غير مسموع بالتعديل ويتم رفع الصنف': case 'يرجي مراجعة كود الاستثناء': return 'badge-danger';
        case 'يتم المراجعة مع المورد': return 'badge-warning';
        default: return 'badge-light';
    }
}

/*************************************************/
/*      APP INITIALIZATION (on load)             */
/*************************************************/
document.addEventListener('DOMContentLoaded', function() {
    const storedUser = sessionStorage.getItem('currentUser');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        initializeApp();
    } else {
        showView('login-view');
        setupLoginListeners();
    }
    document.addEventListener('click', function(event) {
        const suggestionsBox = document.getElementById('autocomplete-suggestions');
        if (suggestionsBox && !event.target.closest('#code') && !event.target.closest('#autocomplete-suggestions')) {
            suggestionsBox.style.display = 'none';
        }
    });
});
