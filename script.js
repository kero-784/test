/*************************************************/
/*          APP CONFIGURATION & GLOBALS          */
/*************************************************/
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzPSTCz7JwB55_giM9Qm8v7bYopg02ypd8sE74lrCDESIiyx9c5h9lnpOEGQY8IE62x/exec"; // PASTE YOUR NEW URL HERE
let masterItemDatabase = [];
let currentUser = null;
let autocompleteDebounceTimer;
let notificationInterval;
let lastNotificationCheck = new Date().toISOString();

/*************************************************/
/*     API COMMUNICATION LAYER (CORS FIX)        */
/*************************************************/
// UPDATED: This function is now simpler and always uses POST to avoid CORS errors.
async function apiRequest(action, data = {}) {
    const loadingIndicator = document.getElementById('loading-indicator');
    loadingIndicator.style.display = 'flex';

    try {
        const payload = {
            action: action,
            user: currentUser, // Pass the current user for authentication on the backend
            data: data // Pass any additional data for the action
        };

        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Required by GAS
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`Network error: ${response.statusText}`);
        
        const result = await response.json();
        if (!result.success) throw new Error(result.error || `An API error occurred for action: ${action}`);
        
        return result;
        
    } catch (error) {
        console.error(`API Error (${action}):`, error);
        displayMessage(error.message, true);
        // Return a standard error format
        return { success: false, error: error.message };
    } finally {
        loadingIndicator.style.display = 'none';
    }
}


/*************************************************/
/*     AUTHENTICATION & INITIALIZATION           */
/*************************************************/
function setupLoginListeners() {
    document.getElementById('login-form').addEventListener('submit', handleLogin);
}

async function handleLogin(event) {
    if (event) event.preventDefault();
    const loginCode = document.getElementById('loginCode').value.trim();
    if (!loginCode) { showLoginError("Login Code is required."); return; }
    
    // For login, the 'user' object is null
    currentUser = null;
    const result = await apiRequest('login', { loginCode: loginCode });

    if (result.success) {
        currentUser = result.user;
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
        initializeApp();
    } else {
        showLoginError(result.error || "Login failed.");
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

    const dbResult = await apiRequest('getItemDatabase');
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
    const result = await apiRequest('getRequests');
    if (result.success) renderBranchRequests(result.data);
}

async function loadOfficerData() {
    const result = await apiRequest('getRequests');
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
            <td><button class="btn btn-sm btn-primary" onclick='reviewRequest(${JSON.stringify(r)})'><i class="fas fa-search"></i> Review</button></td>
        </tr>
    `).join('');
}

/*************************************************/
/*     UI LOGIC & EVENT HANDLERS (for Branch)    */
/*************************************************/
function showView(viewId) { document.querySelectorAll('.view').forEach(v => v.style.display = 'none'); document.getElementById(viewId).style.display = 'block'; }

function handleCodeInput() {
    clearTimeout(autocompleteDebounceTimer);
    autocompleteDebounceTimer = setTimeout(() => {
        const codeInput = document.getElementById('code');
        const suggestionsBox = document.getElementById('autocomplete-suggestions');
        const term = codeInput.value.trim().toLowerCase();
        getItemDetails();
        if (term.length < 1) { suggestionsBox.style.display = 'none'; return; }
        const suggestions = masterItemDatabase.filter(item => String(item.code).toLowerCase().includes(term) || String(item.name).toLowerCase().includes(term)).slice(0, 10);
        if (suggestions.length > 0) {
            suggestionsBox.innerHTML = suggestions.map(s => `<div class="autocomplete-item" onclick="selectAutocompleteItem('${s.code}')"><strong>${s.code}</strong> - ${s.name}</div>`).join('');
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
    document.getElementById('name').value = '';
    document.getElementById('supplierName').value = '';
    if (!code) return;
    const foundItem = masterItemDatabase.find(item => String(item.code) === code);
    if (foundItem) {
        document.getElementById('name').value = foundItem.name || '';
        document.getElementById('supplierName').value = foundItem['supplier name'] || '';
    }
}

function toggleAlternateSupplier() { document.getElementById('alternateSupplierDiv').style.display = document.getElementById('alternateSupplierCheck').checked ? 'block' : 'none'; }
function toggleCurrentPriceField() { document.getElementById('currentPriceDiv').style.display = document.getElementById('type').value === 'مرتجع' ? 'block' : 'none'; }

// UPDATED: Added Calculator functions back
function openCalculatorModal() {
    document.getElementById('modalCost').value = '';
    document.getElementById('modalUnit').value = '1';
    document.getElementById('modalDiscount').value = '0';
    document.getElementById('modalVat').value = '0';
    calculateInModal();
    $('#calculatorModal').modal('show');
}
function calculateInModal() {
    const cost = parseFloat(document.getElementById('modalCost').value) || 0;
    const unit = parseInt(document.getElementById('modalUnit').value) || 0;
    const discount = parseFloat(document.getElementById('modalDiscount').value) || 0;
    const vatRate = parseFloat(document.getElementById('modalVat').value) || 0;
    if (cost < 0 || unit <= 0 || discount < 0) {
        document.getElementById('modalUnitPriceResult').value = 'Invalid Input';
        document.getElementById('modalCasePriceResult').value = 'Invalid Input';
        return;
    }
    const discountedCost = cost * (1 - discount / 100);
    const finalCasePrice = discountedCost * (1 + vatRate / 100);
    const finalUnitPrice = (unit > 0) ? (finalCasePrice / unit) : 0;
    document.getElementById('modalUnitPriceResult').value = finalUnitPrice.toFixed(3);
    document.getElementById('modalCasePriceResult').value = finalCasePrice.toFixed(3);
}
function applyCalculatorPrice() {
    document.getElementById('unitPrice').value = document.getElementById('modalUnitPriceResult').value;
    $('#calculatorModal').modal('hide');
}

// UPDATED: submitRequest now reads from the detailed form
async function submitRequest() {
    const code = document.getElementById('code').value.trim();
    const unitPrice = document.getElementById('unitPrice').value;
    if (!code || !unitPrice) { displayMessage("Code and Final Unit Price are required.", true); return; }
    
    const alternateSupplierCheck = document.getElementById('alternateSupplierCheck').checked;
    const alternateSupplierName = document.getElementById('alternateSupplierName').value.trim();
    let supplier = document.getElementById('supplierName').value.trim();
    if(alternateSupplierCheck && alternateSupplierName) {
        supplier = alternateSupplierName;
    }

    const requestData = {
        code: code,
        name: document.getElementById('name').value.trim(),
        supplier: supplier,
        piece: parseFloat(unitPrice).toFixed(3),
        type: document.getElementById('type').value,
        current: document.getElementById('currentPrice').value || '0'
    };

    const result = await apiRequest('submitRequest', requestData);
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
    document.getElementById('alternateSupplierCheck').checked = false;
    document.getElementById('alternateSupplierName').value = '';
    toggleAlternateSupplier();
    toggleCurrentPriceField();
}


/*************************************************/
/*             OFFICER & REPORTING LOGIC         */
/*************************************************/
function reviewRequest(request) {
    const detailsDiv = document.getElementById('modal-request-details');
    detailsDiv.innerHTML = `
        <p><strong>Branch:</strong> ${request.Branch}</p><p><strong>Submitted By:</strong> ${request.SubmittedBy}</p>
        <p><strong>Item Code:</strong> ${request.ItemCode}</p><p><strong>Item Name:</strong> ${request.ItemName}</p>
        <p><strong>Supplier:</strong> ${request.SubmittedSupplier}</p><p><strong>Request Type:</strong> ${request.Type}</p>
        <p><strong>Requested New Unit Price:</strong> <span class="badge badge-info">${request.SubmittedUnitPrice}</span></p>
        ${request.Type === 'مرتجع' ? `<p><strong>Submitted Current Price:</strong> <span class="badge badge-warning">${request.SubmittedCurrentPrice}</span></p>` : ''}`;
    $('#request-details-modal').data('requestId', request.RequestID);
    $('#request-details-modal').modal('show');
}

async function confirmStatusUpdate() {
    const requestId = $('#request-details-modal').data('requestId');
    const newStatus = document.getElementById('modal-status-select').value;
    const result = await apiRequest('updateRequestStatus', { requestId, newStatus });
    if (result.success) {
        displayMessage('Status updated successfully!');
        $('#request-details-modal').modal('hide');
        loadOfficerData();
    }
}

function showReportsView() { showView('reports-view'); }
function hideReportsView() { showView('main-view'); }

async function generateReport() {
    const filters = {
        startDate: document.getElementById('report-start-date').value,
        endDate: document.getElementById('report-end-date').value,
        status: document.getElementById('report-status').value,
        supplier: document.getElementById('report-supplier').value.trim()
    };
    const result = await apiRequest('getReportData', { filters: filters });
    if(result.success) renderReportResults(result.data);
}

function renderReportResults(data) {
    const tbody = document.getElementById('report-results-table');
    if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="8" class="text-center">No matching records found.</td></tr>'; document.getElementById('report-total-records').textContent = 0; document.getElementById('report-avg-response').textContent = 'N/A'; return; }
    tbody.innerHTML = data.map(r => `<tr><td>${r.RequestID}</td><td>${new Date(r.SubmissionTimestamp).toLocaleString()}</td><td>${r.Branch}</td><td>${r.ItemCode}</td><td>${r.SubmittedSupplier}</td><td>${r.SubmittedUnitPrice}</td><td><span class="badge ${getStatusClass(r.Status)}">${r.Status}</span></td><td>${r.ResponseTimeHours || 'N/A'}</td></tr>`).join('');
    document.getElementById('report-total-records').textContent = data.length;
    const resolvedRequests = data.filter(r => r.ResponseTimeHours);
    if(resolvedRequests.length > 0) {
        const totalHours = resolvedRequests.reduce((sum, r) => sum + parseFloat(r.ResponseTimeHours), 0);
        document.getElementById('report-avg-response').textContent = `${(totalHours / resolvedRequests.length).toFixed(2)}`;
    } else {
        document.getElementById('report-avg-response').textContent = 'N/A';
    }
}

/*************************************************/
/*             NOTIFICATION & UTILITIES          */
/*************************************************/
function startNotificationPolling() {
    notificationInterval = setInterval(async () => {
        const result = await apiRequest('checkForNotifications', { lastCheck: lastNotificationCheck });
        if (result.success && result.data.newEvents.length > 0) {
            lastNotificationCheck = new Date().toISOString();
            displayMessage(result.data.newEvents.join('\n'), false, 10000);
            document.getElementById('notification-sound').play().catch(e => console.warn("Audio playback failed.", e));
            if (currentUser.Role === 'Branch') loadBranchUserData();
            else if (currentUser.Role === 'Officer') loadOfficerData();
        } else if(result.success) {
             lastNotificationCheck = new Date().toISOString();
        }
    }, 30000);
}

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
