// --- GLOBALS ---
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwwwPJuczMkKtC91V0u85z4N4BpTHxNOR-0Eou9pD2ArwChxyXHfN7AzJG3wmT9LVvM/exec";

// FIXED: Central state object to manage data and avoid race conditions on the client.
const state = {
    masterItemDatabase: [],
    currentUser: null,
    autocompleteDebounceTimer: null,
    notificationInterval: null,
    lastNotificationCheck: new Date().toISOString(),
    requestList: [], // For the branch user's new request form
    requests: [], // For the main list view (branch or officer)
    lastUsedUnitCount: 1,
    lastUsedDiscount: 0,
    lastUsedVat: 0,
};

// --- API & AUTH ---
async function apiRequest(action, data = {}, showLoader = false) {
    if (showLoader) document.getElementById('loading-indicator').style.display = 'flex';
    try {
        const payload = { action, user: state.currentUser, data };
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`Network error: ${response.statusText}`);
        const result = await response.json();
        if (!result.success) throw new Error(result.error || `API error for action: ${action}`);
        return result;
    } catch (error) {
        console.error(`API Error (${action}):`, error);
        displayMessage(error.message, true);
        return { success: false, error: error.message };
    } finally {
        if (showLoader) document.getElementById('loading-indicator').style.display = 'none';
    }
}

async function handleLogin(event) {
    // ... (This function is mostly the same but now uses state object)
    if (event) event.preventDefault();
    const loginCode = document.getElementById('loginCode').value.trim();
    if (!loginCode) { showLoginError("Login Code is required."); return; }
    state.currentUser = null;
    const result = await apiRequest('login', { loginCode: loginCode }, true);
    if (result.success) {
        state.currentUser = result.user;
        sessionStorage.setItem('currentUser', JSON.stringify(state.currentUser));
        initializeApp();
    } else {
        showLoginError(result.error || "Login failed.");
    }
}

async function initializeApp() {
    showView('main-view');
    document.getElementById('welcome-message').textContent = `Welcome, ${state.currentUser.DisplayName} (${state.currentUser.Role})`;
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    startNotificationPolling();
    const dbResult = await apiRequest('getItemDatabase', {}, true);
    if (dbResult.success) state.masterItemDatabase = dbResult.data;
    if (state.currentUser.Role === 'Branch') {
        document.getElementById('branch-user-content').style.display = 'block';
        document.getElementById('officer-content').style.display = 'none';
        await loadAndRenderRequests(true);
    } else if (state.currentUser.Role === 'Officer') {
        document.getElementById('branch-user-content').style.display = 'none';
        document.getElementById('officer-content').style.display = 'block';
        await loadAndRenderRequests(true);
    }
}

function handleLogout() {
    // ... (uses state object now)
    state.currentUser = null;
    sessionStorage.removeItem('currentUser');
    if (state.notificationInterval) clearInterval(state.notificationInterval);
    showView('login-view');
    document.getElementById('loginCode').value = '';
}


// --- DATA LOADING & RENDERING ---
// FIXED: Combined loading and rendering logic into one flow.
async function loadAndRenderRequests(showLoader = false) {
    const result = await apiRequest('getRequests', {}, showLoader);
    if (result.success) {
        state.requests = result.data; // Store the fresh data in our local state
        renderRequests();
        flashTable(state.currentUser.Role === 'Officer' ? 'officer-requests-table' : 'branch-requests-table');
    }
}

// FIXED: A single function to decide what to render based on the current state.
function renderRequests() {
    if (state.currentUser.Role === 'Officer') {
        renderOfficerRequests(state.requests);
    } else if (state.currentUser.Role === 'Branch') {
        renderBranchRequests(state.requests);
    }
}

function renderBranchRequests(requests) {
    const tbody = document.getElementById('branch-requests-table');
    if (!requests || requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">No submission history.</td></tr>';
        return;
    }
    // Render based on the passed data
    tbody.innerHTML = requests.map(r => `
        <tr onclick="viewRequestDetails('${r.RequestID}')" style="cursor: pointer;">
            <td>${r.RequestID}</td><td>${new Date(r.SubmissionTimestamp).toLocaleDateString()}</td><td><span class="badge ${getStatusClass(r.OverallStatus)}">${r.OverallStatus}</span></td></tr>
    `).join('');
}

function renderOfficerRequests(requests) {
    const tbody = document.getElementById('officer-requests-table');
    if (!requests || requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No requests found.</td></tr>';
        return;
    }
    // Render based on the passed data
    tbody.innerHTML = requests.map(r => {
        const isCompleted = r.OverallStatus === 'Completed';
        return `
            <tr class="${isCompleted ? 'table-light text-muted' : ''}">
                <td>${r.RequestID}</td><td>${new Date(r.SubmissionTimestamp).toLocaleDateString()}</td><td>${r.Branch}</td><td>${r.SubmittedBy}</td>
                <td><span class="badge ${getStatusClass(r.OverallStatus)}">${r.OverallStatus}</span></td>
                <td><button class="btn btn-sm btn-primary" onclick="reviewRequest('${r.RequestID}')" ${isCompleted ? 'disabled' : ''}><i class="fas fa-search"></i> ${isCompleted ? 'View' : 'Review'}</button></td>
            </tr>
        `;
    }).join('');
}


// --- BRANCH USER FORM & LIST LOGIC ---
// ... (No major changes in this section, it already worked well)
function handleCodeInput() { clearTimeout(state.autocompleteDebounceTimer); state.autocompleteDebounceTimer = setTimeout(() => { const codeInput = document.getElementById('code'); const suggestionsBox = document.getElementById('autocomplete-suggestions'); const term = codeInput.value.trim().toLowerCase(); getItemDetails(); if (term.length < 1) { suggestionsBox.style.display = 'none'; return; } const suggestions = state.masterItemDatabase.filter(item => String(item.code).toLowerCase().includes(term) || String(item.name).toLowerCase().includes(term)).slice(0, 10); if (suggestions.length > 0) { suggestionsBox.innerHTML = suggestions.map(s => `<div class="autocomplete-item" onclick="selectAutocompleteItem('${s.code}')"><strong>${s.code}</strong> - ${s.name}</div>`).join(''); suggestionsBox.style.display = 'block'; } else { suggestionsBox.style.display = 'none'; } }, 250); }
function selectAutocompleteItem(code) { document.getElementById('code').value = code; document.getElementById('autocomplete-suggestions').style.display = 'none'; getItemDetails(); document.getElementById('unitPrice').focus(); }
function getItemDetails() { const code = document.getElementById('code').value.trim(); document.getElementById('name').value = ''; document.getElementById('supplierName').value = ''; if (!code) return; const foundItem = state.masterItemDatabase.find(item => String(item.code) === code); if (foundItem) { document.getElementById('name').value = foundItem.name || ''; document.getElementById('supplierName').value = foundItem['supplier name'] || ''; } }
function toggleAlternateSupplier() { document.getElementById('alternateSupplierDiv').style.display = document.getElementById('alternateSupplierCheck').checked ? 'block' : 'none'; }
function toggleCurrentPriceField() { document.getElementById('currentPriceDiv').style.display = document.getElementById('type').value === 'مرتجع' ? 'block' : 'none'; }
function openCalculatorModal() { document.getElementById('modalCost').value = ''; document.getElementById('modalUnit').value = state.lastUsedUnitCount || '1'; document.getElementById('modalDiscount').value = state.lastUsedDiscount || '0'; document.getElementById('modalVat').value = state.lastUsedVat || '0'; calculateInModal(); $('#calculatorModal').modal('show'); }
function calculateInModal() { const cost = parseFloat(document.getElementById('modalCost').value) || 0; const unit = parseInt(document.getElementById('modalUnit').value) || 1; const discount = parseFloat(document.getElementById('modalDiscount').value) || 0; const vatRate = parseFloat(document.getElementById('modalVat').value) || 0; const discountedCost = cost * (1 - discount / 100); const finalCasePrice = discountedCost * (1 + vatRate / 100); const finalUnitPrice = (unit > 0) ? (finalCasePrice / unit) : 0; document.getElementById('modalUnitPriceResult').value = finalUnitPrice.toFixed(3); document.getElementById('modalCasePriceResult').value = finalCasePrice.toFixed(3); }
function applyCalculatorPrice() { document.getElementById('unitPrice').value = document.getElementById('modalUnitPriceResult').value; state.lastUsedUnitCount = parseInt(document.getElementById('modalUnit').value) || 1; state.lastUsedDiscount = parseFloat(document.getElementById('modalDiscount').value) || 0; state.lastUsedVat = parseFloat(document.getElementById('modalVat').value) || 0; $('#calculatorModal').modal('hide'); }
function addToList() { const code = document.getElementById('code').value.trim(); const unitPrice = document.getElementById('unitPrice').value; if (!code || !unitPrice) { displayMessage("Code and Final Unit Price are required.", true); return; } const alternateSupplierCheck = document.getElementById('alternateSupplierCheck').checked; const alternateSupplierName = document.getElementById('alternateSupplierName').value.trim(); let supplier = document.getElementById('supplierName').value.trim(); if(alternateSupplierCheck && alternateSupplierName) supplier = alternateSupplierName; const finalUnitPrice = parseFloat(unitPrice); const newItem = { code: code, name: document.getElementById('name').value.trim(), supplier: supplier, units: state.lastUsedUnitCount, discount: state.lastUsedDiscount, vat: state.lastUsedVat, piece: finalUnitPrice.toFixed(3), case: (finalUnitPrice * state.lastUsedUnitCount).toFixed(3), type: document.getElementById('type').value, current: document.getElementById('currentPrice').value || '0' }; state.requestList.push(newItem); displayMessage("Item added to list.", false, 1500); clearRequestForm(); renderRequestListTable(); }
function renderRequestListTable() { const card = document.getElementById('submission-list-card'); const tbody = document.getElementById('submission-list-tbody'); if (state.requestList.length === 0) { card.style.display = 'none'; return; } card.style.display = 'block'; tbody.innerHTML = state.requestList.map((item, index) => ` <tr><td>${item.code}</td><td>${item.name}</td><td>${item.supplier}</td><td>${item.units}</td><td>${item.discount}</td> <td>${item.vat}</td><td>${item.piece}</td><td>${item.case}</td> <td><button class="btn btn-danger btn-sm" onclick="removeFromList(${index})" title="Remove"><i class="fas fa-times"></i></button></td></tr> `).join(''); }
function removeFromList(index) { state.requestList.splice(index, 1); renderRequestListTable(); }
function clearRequestList() { if (confirm("Are you sure you want to clear the entire pending list?")) { state.requestList = []; renderRequestListTable(); } }
async function submitAllRequests() { if (state.requestList.length === 0) { displayMessage("List is empty.", true); return; } if (!confirm(`Submit ${state.requestList.length} item(s) for approval?`)) return; const result = await apiRequest('submitRequest', state.requestList, true); if (result.success) { displayMessage(result.message || 'Requests submitted!'); state.requestList = []; renderRequestListTable(); loadAndRenderRequests(); } }
function clearRequestForm() { document.getElementById('code').value = ''; document.getElementById('name').value = ''; document.getElementById('supplierName').value = ''; document.getElementById('unitPrice').value = ''; document.getElementById('currentPrice').value = ''; document.getElementById('alternateSupplierCheck').checked = false; document.getElementById('alternateSupplierName').value = ''; toggleAlternateSupplier(); toggleCurrentPriceField(); document.getElementById('code').focus(); }
async function viewRequestDetails(requestID) { const result = await apiRequest('getRequestDetails', { requestID: requestID }, true); if (result.success && result.data) { document.getElementById('branch-modal-request-id').textContent = requestID; const tbody = document.getElementById('branch-modal-items-tbody'); tbody.innerHTML = result.data.map(item => ` <tr><td>${item.ItemCode}</td><td>${item.ItemName}</td><td>${item.SubmittedSupplier}</td><td>${item.SubmittedPiecePrice}</td><td>${item.Status}</td></tr> `).join(''); $('#branch-view-details-modal').modal('show'); } }

// --- OFFICER LOGIC ---
async function reviewRequest(requestID) {
    const result = await apiRequest('getRequestDetails', { requestID: requestID }, true);
    if (result.success && result.data) {
        document.getElementById('modal-request-id-title').textContent = requestID;
        $('#request-details-modal').data('requestId', requestID);
        renderOfficerModal(result.data);
        document.getElementById('master-status-select').onchange = applyMasterStatus;
        $('#request-details-modal').modal('show');
    }
}
function renderOfficerModal(items) { /* ... no changes ... */ const tbody = document.getElementById('modal-items-tbody'); tbody.innerHTML = items.map(item => ` <tr data-item-id="${item.ItemID}"> <td>${item.ItemCode}</td><td>${item.ItemName}</td><td>${item.SubmittedPiecePrice}</td><td>${item.SubmittedCasePrice}</td> <td><select class="form-control form-control-sm item-status-select"> <option ${item.Status === 'Pending' ? 'selected' : ''}>Pending</option> <option ${item.Status === 'تم التعديل' ? 'selected' : ''}>تم التعديل</option> <option ${item.Status === 'غير مسموع بالتعديل ويتم رفع الصنف' ? 'selected' : ''}>غير مسموع بالتعديل ويتم رفع الصنف</option> <option ${item.Status === 'تم التعديل جزئيا' ? 'selected' : ''}>تم التعديل جزئيا</option> <option ${item.Status === 'يرجي مراجعة كود الاستثناء' ? 'selected' : ''}>يرجي مراجعة كود الاستثناء</option> <option ${item.Status === 'يتم المراجعة مع المورد' ? 'selected' : ''}>يتم المراجعة مع المورد</option> </select></td></tr> `).join(''); }
function applyMasterStatus() { /* ... no changes ... */ const masterStatus = document.getElementById('master-status-select').value; if (!masterStatus) return; document.querySelectorAll('.item-status-select').forEach(select => { select.value = masterStatus; }); }

// FIXED: Now re-fetches data on success to get the latest state.
async function saveItemChanges() {
    const updates = [];
    document.querySelectorAll('#modal-items-tbody tr').forEach(row => {
        updates.push({ itemID: row.dataset.itemId, newStatus: row.querySelector('.item-status-select').value });
    });
    if (updates.length === 0) { displayMessage("No items to update.", true); return; }
    const result = await apiRequest('updateItemStatuses', { updates: updates }, true);
    if (result.success) {
        displayMessage(result.message || 'Item changes saved successfully!');
        // Re-fetch all data to ensure UI is perfectly in sync with the backend.
        loadAndRenderRequests();
    }
}

// FIXED: Now updates local state for an instant UI change, avoiding race conditions.
async function finalizeRequest() {
    const requestID = $('#request-details-modal').data('requestId');
    if (!requestID) { displayMessage("Could not identify the Request ID.", true); return; }
    if (confirm(`Are you sure you want to finalize and close Request ${requestID}? This action will notify the user and cannot be undone.`)) {
        const result = await apiRequest('finalizeRequest', { requestID: requestID }, true);
        if (result.success) {
            displayMessage(result.message);
            $('#request-details-modal').modal('hide');

            // --- START FIX ---
            // Find the request in our local state and update it.
            const requestToUpdate = state.requests.find(req => req.RequestID === requestID);
            if (requestToUpdate) {
                requestToUpdate.OverallStatus = 'Completed';
            }
            // Re-render the list from our updated local state. This is instant.
            renderRequests();
            // --- END FIX ---
        }
    }
}

// --- UTILITIES & STARTUP ---
function getStatusClass(status) { /* ... no changes ... */ switch(status) { case 'Pending': return 'badge-secondary'; case 'Partially Completed': return 'badge-info'; case 'Completed': return 'badge-success'; default: return 'badge-light'; } }

// FIXED: Notification polling now triggers a full data refresh.
function startNotificationPolling() {
    if (state.notificationInterval) clearInterval(state.notificationInterval);
    state.notificationInterval = setInterval(async () => {
        if (document.hidden || !state.currentUser) return;
        const result = await apiRequest('checkForNotifications', { lastCheck: state.lastNotificationCheck });
        if (result.success) {
            state.lastNotificationCheck = new Date().toISOString();
            if (result.data.newEvents.length > 0) {
                displayMessage(result.data.newEvents.join('\n'), false, 10000);
                document.getElementById('notification-sound').play().catch(e => console.warn("Audio playback failed.", e));
                // A notification means data has changed, so we must reload.
                loadAndRenderRequests();
            }
        }
    }, 15000);
}

function flashTable(tableId) { /* ... no changes ... */ const table = document.getElementById(tableId); if (!table) return; const header = table.querySelector('thead'); if (!header) return; header.classList.add('table-flash'); setTimeout(() => { header.classList.remove('table-flash'); }, 1500); }
function showView(viewId) { document.querySelectorAll('.view').forEach(v => v.style.display = 'none'); document.getElementById(viewId).style.display = 'block'; }
function displayMessage(message, isError = false, duration = 3000) { const el = document.getElementById('message-container'); el.textContent = message; el.className = isError ? 'error show' : 'success show'; setTimeout(() => { el.classList.remove('show'); }, duration); }
function showLoginError(message) { const el = document.getElementById('login-error'); el.textContent = message; el.style.display = 'block'; }
document.addEventListener('DOMContentLoaded', function() { const storedUser = sessionStorage.getItem('currentUser'); if (storedUser) { state.currentUser = JSON.parse(storedUser); initializeApp(); } else { showView('login-view'); } document.addEventListener('click', function(event) { const suggestionsBox = document.getElementById('autocomplete-suggestions'); if (suggestionsBox && !event.target.closest('#code') && !event.target.closest('#autocomplete-suggestions')) { suggestionsBox.style.display = 'none'; } }); document.getElementById('login-form').addEventListener('submit', handleLogin); }); // Simplified listeners for demo
