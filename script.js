// --- GLOBALS ---
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxxwFjSm2vWSEQUSsMNsvrw8fd9wAoIAKUboYbHWOtkt_juQEW25ICWzU1TnVDJ-HdLRw/exec";

// PASTE YOUR FIREBASE CONFIG OBJECT HERE
const firebaseConfig = {
  apiKey: "AIzaSyArzJBvvr4Zf4mADNWaJH7AnrzXm9lKsYY",
  authDomain: "price-request-26377.firebaseapp.com",
  databaseURL: "https://price-request-26377-default-rtdb.firebaseio.com",
  projectId: "price-request-26377",
  storageBucket: "price-request-26377.firebasestorage.app",
  messagingSenderId: "590894085209",
  appId: "1:590894085209:web:a9d1fdc7ab93e994a2ed48"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

const state = { masterItemDatabase: [], currentUser: null, autocompleteDebounceTimer: null, notificationListener: null, requestList: [], requests: [], lastUsedUnitCount: 1, lastUsedDiscount: 0, lastUsedVat: 0 };
const dom = {};

// --- API & AUTH ---
async function apiRequest(action, data = {}, showLoader = false) { if (showLoader) dom.loadingIndicator.style.display = 'flex'; try { const payload = { action, user: state.currentUser, data }; const response = await fetch(GAS_WEB_APP_URL, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload), redirect: 'follow' }); if (!response.ok) throw new Error(`Network error: ${response.statusText}`); const result = await response.json(); if (!result.success) throw new Error(result.error || `API error for action: ${action}`); return result; } catch (error) { console.error(`API Error (${action}):`, error); displayMessage(error.message, true); return { success: false, error: error.message }; } finally { if (showLoader) dom.loadingIndicator.style.display = 'none'; } }
async function handleLogin(event) {
    if (event) event.preventDefault();
    const loginCode = dom.loginCodeInput.value.trim();
    if (!loginCode) { showLoginError("Login Code is required."); return; }
    dom.loginError.style.display = 'none';
    try {
        const loginResult = await apiRequest('login', { loginCode }, true);
        if (!loginResult.success) throw new Error(loginResult.error);
        state.currentUser = loginResult.user;
        await auth.signInWithCustomToken(loginResult.token);
        dom.notificationSound.muted = true; try { await dom.notificationSound.play(); } catch (e) { console.warn("Audio context unlock failed, but this is expected on some browsers."); } dom.notificationSound.muted = false;
        const dbResult = await apiRequest('getItemDatabase', {}, true);
        if (dbResult.success) { state.masterItemDatabase = dbResult.data; sessionStorage.setItem('currentUser', JSON.stringify(state.currentUser)); initializeApp(); } else { throw new Error("Could not load product database."); }
    } catch (error) { showLoginError(error.message); state.currentUser = null; }
}
async function initializeApp() { showView('main-view'); dom.welcomeMessage.textContent = `Welcome, ${state.currentUser.DisplayName} (${state.currentUser.Role})`; renderNav(); showMainAppView(); startRealtimeListener(); }
function handleLogout() { auth.signOut(); state.currentUser = null; sessionStorage.removeItem('currentUser'); if (state.notificationListener) database.ref('notifications').off('child_added', state.notificationListener); showView('login-view'); dom.loginForm.reset(); state.requests = []; state.requestList = []; state.masterItemDatabase = []; dom.navButtons.innerHTML = ''; dom.appContentArea.innerHTML = ''; }

// --- LIVE NOTIFICATIONS ---
function startRealtimeListener() {
    if (state.notificationListener) database.ref('notifications').off('child_added', state.notificationListener);
    const notificationsRef = database.ref('notifications');
    state.notificationListener = notificationsRef.on('child_added', async (snapshot) => {
        const notification = snapshot.val();
        snapshot.ref.remove();
        if ($('.modal.show').length > 0 && notification.type === 'fullscreen') { console.log("Blocking fullscreen notification because a modal is already open."); return; }
        const isForMe = (notification.recipientRole && notification.recipientRole.includes(state.currentUser.Role)) || (notification.recipientLoginCode && notification.recipientLoginCode === state.currentUser.LoginCode);
        if (isForMe) {
            console.log("Real-time notification received:", notification);
            dom.notificationSound.play().catch(e => {});
            if (notification.type === 'fullscreen') { showFullscreenNotification({ requestID: notification.requestID }); } else { displayMessage(notification.message); }
            const refreshResult = await apiRequest('getRequests', {});
            if (refreshResult.success) { state.requests = refreshResult.data; renderRequests(); }
        }
    });
}

// --- NAVIGATION & VIEW MANAGEMENT ---
function renderNav() { let navHTML = `<button class="btn btn-sm btn-outline-primary active" id="nav-main-btn">Main App</button>`; if (['Admin', 'Officer'].includes(state.currentUser.Role)) { navHTML += `<button class="btn btn-sm btn-outline-secondary" id="nav-reports-btn">Reports</button>`; } if (state.currentUser.Role === 'Admin') { navHTML += `<button class="btn btn-sm btn-outline-danger" id="nav-admin-btn">Users</button>`; } dom.navButtons.innerHTML = navHTML; }
function showMainAppView() {
    let contentHTML = ``;
    if (state.currentUser.Role === 'Branch') {
        contentHTML = `<div id="branch-user-content"><div class="card mb-3"><div class="card-header">Item Details & Pricing</div><div class="card-body"><form id="item-details-form"><div class="form-row"><div class="form-group col-md-6" style="position: relative;"><label for="code">Item Code</label><input type="text" class="form-control" id="code"><div id="autocomplete-suggestions" class="autocomplete-box"></div></div><div class="form-group col-md-6"><label for="type">Request Type</label><select class="form-control" id="type"><option value="شراء">شراء</option><option value="مرتجع">مرتجع</option></select></div></div><div class="form-group" id="currentPriceDiv" style="display:none;"><label for="currentPrice">Current Price</label><input type="number" step="0.001" class="form-control" id="currentPrice"></div><div class="form-group"><label for="name">Item Name</label><input type="text" class="form-control" id="name" readonly></div><div class="form-group"><label for="supplierName">Default Supplier</label><input type="text" class="form-control" id="supplierName" readonly></div><div class="form-group"><div class="form-check"><input type="checkbox" class="form-check-input" id="alternateSupplierCheck"><label class="form-check-label" for="alternateSupplierCheck">شراء من مورد اخر</label></div></div><div class="form-group" id="alternateSupplierDiv" style="display: none;"><label for="alternateSupplierName">Alternate Supplier Name</label><input type="text" class="form-control" id="alternateSupplierName"></div><hr><div class="form-group"><label for="unitPrice">Final Unit Price</label><div class="input-group"><input type="number" step="0.001" class="form-control" id="unitPrice"><div class="input-group-append"><button class="btn btn-outline-secondary" type="button" id="calc-btn" title="Calculate from Case Cost"><i class="fas fa-calculator"></i></button></div></div></div><button type="button" class="btn btn-success" id="add-to-list-btn"><i class="fas fa-plus"></i> Add Item</button></form></div></div><div id="submission-list-card" class="card mb-3" style="display:none;"><div class="card-header">Pending Items</div><div class="card-body"><div class="table-responsive"><table class="table table-sm table-striped"><thead><tr><th>Code</th><th>Name</th><th>Supplier</th><th>Units</th><th>Disc.</th><th>VAT</th><th>Piece</th><th>Case</th><th>Actions</th></tr></thead><tbody id="submission-list-tbody"></tbody></table></div><hr><div class="d-flex justify-content-between"><button class="btn btn-danger" id="clear-list-btn"><i class="fas fa-trash"></i> Clear</button><button class="btn btn-primary" id="submit-all-btn"><i class="fas fa-paper-plane"></i> Submit</button></div></div></div><div class="card"><div class="card-header">My Submission History <button class="btn btn-sm btn-outline-secondary toggle-history-btn"><i class="fas fa-eye"></i> Show</button></div><div class="card-body table-responsive p-0" id="branch-history-container" style="display:none;"><table id="branch-requests-table" class="table table-hover mb-0"><thead><tr><th>ID</th><th>Date</th><th>Status</th></tr></thead><tbody></tbody></table></div></div></div>`;
    } else if (['Officer', 'Admin'].includes(state.currentUser.Role)) {
        contentHTML = `<div id="officer-content"><div class="card"><div class="card-header">All Price Update Requests</div><div class="card-body table-responsive p-0"><table id="officer-requests-table" class="table table-hover mb-0"><thead><tr><th>ID</th><th>Date</th><th>Branch</th><th>By</th><th>Status</th><th>Actions</th></tr></thead><tbody></tbody></table></div></div></div>`;
    }
    dom.appContentArea.innerHTML = contentHTML;
    cacheAppDOMElements();
    loadAndRenderRequests();
}
async function showAdminView() {
    const contentHTML = `<div id="admin-view"><div class="card"><div class="card-header">User Management</div><div class="card-body"><div class="admin-actions"><button class="btn btn-success" id="add-user-btn"><i class="fas fa-plus"></i> Add New User</button></div><div class="table-responsive"><table class="table table-striped"><thead><tr><th>Login Code</th><th>Display Name</th><th>Role</th><th>Branch</th><th>Actions</th></tr></thead><tbody id="users-table-tbody"></tbody></table></div></div></div></div>`;
    dom.appContentArea.innerHTML = contentHTML;
    const usersResult = await apiRequest('getUsers', {}, true);
    if(usersResult.success) renderUsersTable(usersResult.data);
}
async function showReportsView() {
    const contentHTML = `<div id="reports-view"><div class="card"><div class="card-header">Activity Log Report</div><div class="card-body"><div class="filter-controls row align-items-end"><div class="form-group col-md-3"><label>Start Date</label><input type="date" id="report-start-date" class="form-control"></div><div class="form-group col-md-3"><label>End Date</label><input type="date" id="report-end-date" class="form-control"></div><div class="form-group col-md-3"><label>User</label><select id="report-user-filter" class="form-control"><option value="">All Users</option></select></div><div class="form-group col-md-3"><label>Action</label><select id="report-action-filter" class="form-control"><option value="">All Actions</option></select></div><div class="col-12 text-right"><button class="btn btn-primary" id="generate-report-btn"><i class="fas fa-sync-alt"></i> Generate Report</button></div></div><div class="table-responsive"><table class="table table-sm table-striped"><thead><tr><th>Timestamp</th><th>User</th><th>Role</th><th>Action</th><th>Details</th></tr></thead><tbody id="report-results-tbody"></tbody></table></div></div></div></div>`;
    dom.appContentArea.innerHTML = contentHTML;
    populateReportFilters();
}

// --- DATA LOADING & RENDERING ---
async function loadAndRenderRequests(showLoader = false) { const result = await apiRequest('getRequests', {}, showLoader); if (result.success) { state.requests = result.data; renderRequests(); } }
function renderRequests() { if (!state.currentUser) return; if (['Officer', 'Admin'].includes(state.currentUser.Role)) renderOfficerRequests(state.requests); else if (state.currentUser.Role === 'Branch') renderBranchRequests(state.requests); }
function renderBranchRequests(requests) { const tbody = document.getElementById('branch-requests-table'); if(!tbody) return; tbody.innerHTML = requests && requests.length > 0 ? requests.map(r => { const { badgeClass, statusText } = getStatusSummary(r); return `<tr data-request-id="${r.RequestID}" style="cursor: pointer;"><td>${r.RequestID}</td><td>${new Date(r.SubmissionTimestamp).toLocaleDateString()}</td><td><span class="badge ${badgeClass}">${statusText}</span></td></tr>`; }).join('') : '<tr><td colspan="3" class="text-center p-4">No submission history.</td></tr>'; }
function renderOfficerRequests(requests) { const tbody = document.getElementById('officer-requests-table'); if(!tbody) return; tbody.innerHTML = requests && requests.length > 0 ? requests.map(r => { const { badgeClass, statusText } = getStatusSummary(r); const isResponded = !!r.OfficerResponseTimestamp; return `<tr class="${isResponded ? 'table-light text-muted' : ''}"><td>${r.RequestID}</td><td>${new Date(r.SubmissionTimestamp).toLocaleDateString()}</td><td>${r.Branch}</td><td>${r.SubmittedBy}</td><td><span class="badge ${badgeClass}">${statusText}</span></td><td><button class="btn btn-sm btn-primary review-btn" data-request-id="${r.RequestID}"><i class="fas fa-search"></i> ${isResponded ? 'View' : 'Review'}</button></td></tr>`; }).join('') : '<tr><td colspan="6" class="text-center p-4">No requests found.</td></tr>'; }

// --- USER MANAGEMENT (Admin) ---
function renderUsersTable(users) { const tbody = document.getElementById('users-table-tbody'); tbody.innerHTML = users.map(u => `<tr><td>${u.LoginCode}</td><td>${u.DisplayName}</td><td>${u.Role}</td><td>${u.Branch}</td><td><button class="btn btn-sm btn-info edit-user-btn" data-user='${JSON.stringify(u)}'><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger delete-user-btn" data-logincode="${u.LoginCode}"><i class="fas fa-trash"></i></button></td></tr>`).join(''); }
function openUserModal(user = null) { const userForm = document.getElementById('user-form'); const userModalTitle = document.getElementById('user-modal-title'); userForm.reset(); if(user) { userModalTitle.textContent = "Edit User"; document.getElementById('user-form-original-logincode').value = user.LoginCode; document.getElementById('user-logincode').value = user.LoginCode; document.getElementById('user-logincode').readOnly = true; document.getElementById('user-displayname').value = user.DisplayName; document.getElementById('user-role').value = user.Role; document.getElementById('user-branch').value = user.Branch; } else { userModalTitle.textContent = "Add User"; document.getElementById('user-form-original-logincode').value = ''; document.getElementById('user-logincode').readOnly = false; } $('#user-modal').modal('show'); }
async function saveUser() { const userData = { LoginCode: document.getElementById('user-logincode').value.trim(), DisplayName: document.getElementById('user-displayname').value.trim(), Role: document.getElementById('user-role').value, Branch: document.getElementById('user-branch').value, originalLoginCode: document.getElementById('user-form-original-logincode').value }; if(!userData.LoginCode || !userData.DisplayName) { displayMessage("Login Code and Display Name are required.", true); return; } const action = userData.originalLoginCode ? 'updateUser' : 'addUser'; const result = await apiRequest(action, userData, true); if(result.success) { displayMessage(result.message); $('#user-modal').modal('hide'); await showAdminView(); } }
async function deleteUser(loginCode) { if(loginCode === state.currentUser.LoginCode) { displayMessage("You cannot delete your own account.", true); return; } if(confirm(`Are you sure you want to delete user ${loginCode}? This cannot be undone.`)) { const result = await apiRequest('deleteUser', { LoginCode: loginCode }, true); if(result.success) { displayMessage(result.message); await showAdminView(); } } }

// --- REPORTING ---
async function populateReportFilters() { const usersResult = await apiRequest('getUsers'); if(usersResult.success) { const userFilter = document.getElementById('report-user-filter'); usersResult.data.forEach(u => userFilter.innerHTML += `<option value="${u.LoginCode}">${u.DisplayName} (${u.LoginCode})</option>`); } const actions = ['LOGIN_SUCCESS', 'LOGIN_FAIL', 'SUBMIT_BATCH_REQUEST', 'UPDATE_ITEM_STATUS', 'FINALIZE_FOR_BRANCH', 'CONFIRM_RECEIPT', 'ADD_USER', 'UPDATE_USER', 'DELETE_USER']; const actionFilter = document.getElementById('report-action-filter'); actions.forEach(a => actionFilter.innerHTML += `<option>${a}</option>`); }
async function generateActivityReport() { const filters = { startDate: document.getElementById('report-start-date').value, endDate: document.getElementById('report-end-date').value, user: document.getElementById('report-user-filter').value, action: document.getElementById('report-action-filter').value }; const result = await apiRequest('getFilteredLogs', filters, true); if(result.success) renderActivityLogTable(result.data); }
function renderActivityLogTable(logs) { const tbody = document.getElementById('report-results-tbody'); if(!logs || logs.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4">No logs found.</td></tr>'; return; } tbody.innerHTML = logs.map(log => `<tr><td>${new Date(log.Timestamp).toLocaleString()}</td><td>${log.Username}</td><td>${log.Role}</td><td><span class="badge badge-light">${log.Action}</span></td><td>${log.Details}</td></tr>`).join(''); }

// --- OFFICER ACTIONS ---
async function reviewRequest(requestID) { const result = await apiRequest('getRequestDetails', { requestID }, true); if (result.success && result.data) { document.getElementById('modal-request-id-title').textContent = requestID; $('#request-details-modal').data('requestId', requestID); renderOfficerModal(result.data); $('#request-details-modal').modal('show'); } }
function renderOfficerModal(items) {
    const tbody = document.getElementById('modal-items-tbody');
    tbody.innerHTML = items.map(item => `
        <tr data-item-id="${item.ItemID}"><td>${item.ItemCode}</td><td>${item.ItemName}</td><td><span class="badge badge-pill badge-light">${item.RequestType || 'N/A'}</span></td><td>${item.SubmittedSupplier}</td><td>${item.CurrentPrice || '0'}</td><td>${item.SubmittedPiecePrice}</td><td><select class="form-control form-control-sm item-status-select"><option>Pending</option><option>تم التعديل</option><option>غير مسموع بالتعديل ويتم رفع الصنف</option><option>تم التعديل جزئيا</option><option>يرجي مراجعة كود الاستثناء</option><option>يتم المراجعة مع المورد</option></select></td></tr>`).join('');
    items.forEach((item, index) => { tbody.rows[index].querySelector('.item-status-select').value = item.Status; });
}
async function saveAndNotify() {
    const requestID = $('#request-details-modal').data('requestId');
    if (!requestID) return;
    const updates = Array.from(document.getElementById('modal-items-tbody').querySelectorAll('tr')).map(row => ({ itemID: row.dataset.itemId, newStatus: row.querySelector('.item-status-select').value }));
    if (confirm(`This will SAVE all item changes and NOTIFY the branch for Request ${requestID}. Continue?`)) {
        const result = await apiRequest('saveAndNotifyBranch', { updates, requestID }, true);
        if (result.success) {
            displayMessage(result.message);
            $('#request-details-modal').modal('hide');
            const request = state.requests.find(r => r.RequestID === requestID);
            if (request) {
                request.OfficerResponseTimestamp = new Date().toISOString();
                request.itemsPending = result.data.itemsPending;
            }
            renderRequests();
        }
    }
}

// --- BRANCH ACTIONS ---
async function viewRequestDetails(requestID) { const result = await apiRequest('getRequestDetails', { requestID }, true); if (result.success && result.data) { document.getElementById('branch-modal-request-id').textContent = requestID; document.getElementById('branch-modal-items-tbody').innerHTML = result.data.map(item => `<tr><td>${item.ItemCode}</td><td>${item.ItemName}</td><td>${item.SubmittedSupplier}</td><td>${item.SubmittedPiecePrice}</td><td><span class="badge ${getStatusClass(item.Status)}">${item.Status}</span></td></tr>`).join(''); const request = state.requests.find(r => r.RequestID === requestID); const confirmBtn = document.getElementById('confirm-receipt-btn'); if (request && request.OfficerResponseTimestamp && !request.BranchConfirmTimestamp) { confirmBtn.style.display = 'inline-block'; confirmBtn.dataset.requestId = requestID; } else { confirmBtn.style.display = 'none'; } $('#branch-view-details-modal').modal('show'); } }
function addToList() { const code = document.getElementById('code').value.trim(); const unitPrice = document.getElementById('unitPrice').value; if (!code || !unitPrice) { displayMessage("Code and Final Unit Price are required.", true); return; } const alternateSupplierCheck = document.getElementById('alternateSupplierCheck').checked; const alternateSupplierName = document.getElementById('alternateSupplierName').value.trim(); let supplier = alternateSupplierCheck && alternateSupplierName ? alternateSupplierName : document.getElementById('supplierName').value.trim(); const finalUnitPrice = parseFloat(unitPrice); const newItem = { code, name: document.getElementById('name').value.trim(), supplier, units: state.lastUsedUnitCount, discount: state.lastUsedDiscount, vat: state.lastUsedVat, piece: finalUnitPrice.toFixed(3), case: (finalUnitPrice * state.lastUsedUnitCount).toFixed(3), type: document.getElementById('type').value, current: document.getElementById('currentPrice').value || '0' }; state.requestList.push(newItem); displayMessage("Item added to list."); clearRequestForm(); renderRequestListTable(); }
async function confirmReceipt() { const requestID = document.getElementById('confirm-receipt-btn').dataset.requestId; if (!requestID) return; const result = await apiRequest('confirmReceipt', { requestID }, true); if (result.success) { displayMessage(result.message); document.getElementById('confirm-receipt-btn').style.display = 'none'; const request = state.requests.find(r => r.RequestID === requestID); if(request) request.BranchConfirmTimestamp = new Date().toISOString(); renderRequests(); } }

// --- HELPER FUNCTIONS ---
function showView(viewId) { document.querySelectorAll('.view').forEach(v => v.style.display = 'none'); document.getElementById(viewId).style.display = 'block'; }
function clearRequestForm() { document.getElementById('item-details-form').reset(); document.getElementById('alternateSupplierDiv').style.display = 'none'; document.getElementById('currentPriceDiv').style.display = 'none'; document.getElementById('code').focus(); }
function renderRequestListTable() { const card = document.getElementById('submission-list-card'); const tbody = document.getElementById('submission-list-tbody'); const header = card.querySelector('.card-header'); if (state.requestList.length === 0) { card.style.display = 'none'; return; } card.style.display = 'block'; header.textContent = `Pending Items (${state.requestList.length})`; tbody.innerHTML = state.requestList.map((item, index) => `<tr><td>${item.code}</td><td>${item.name}</td><td>${item.supplier}</td><td>${item.units}</td><td>${item.discount}%</td><td>${item.vat}%</td><td>${item.piece}</td><td>${item.case}</td><td><button class="btn btn-sm btn-danger remove-item-btn" data-index="${index}"><i class="fas fa-times"></i></button></td></tr>`).join(''); }
function getItemDetails() { const code = document.getElementById('code').value.trim(); const nameInput = document.getElementById('name'); const supplierInput = document.getElementById('supplierName'); nameInput.value = ''; supplierInput.value = ''; if (!code) return; const foundItem = state.masterItemDatabase.find(item => String(item.code) === code); if (foundItem) { nameInput.value = foundItem.name || ''; supplierInput.value = foundItem['supplier name'] || ''; } }
function selectAutocompleteItem(code) { document.getElementById('code').value = code; document.getElementById('autocomplete-suggestions').style.display = 'none'; getItemDetails(); document.getElementById('unitPrice').focus(); }
function clearRequestList() { if (confirm("Clear the entire list?")) { state.requestList = []; renderRequestListTable(); } }
async function submitAllRequests() { if (state.requestList.length === 0) return; if (confirm(`Submit ${state.requestList.length} items?`)) { const result = await apiRequest('submitRequest', state.requestList, true); if (result.success) { displayMessage(result.message); state.requestList = []; renderRequestListTable(); await loadAndRenderRequests(); } } }
function handleCodeInput() { clearTimeout(state.autocompleteDebounceTimer); state.autocompleteDebounceTimer = setTimeout(() => { const term = document.getElementById('code').value.trim().toLowerCase(); getItemDetails(); if (term.length < 1) { document.getElementById('autocomplete-suggestions').style.display = 'none'; return; } const suggestions = state.masterItemDatabase.filter(item => String(item.code).toLowerCase().includes(term) || String(item.name).toLowerCase().includes(term)).slice(0, 10); if (suggestions.length > 0) { document.getElementById('autocomplete-suggestions').innerHTML = suggestions.map(s => `<div class="autocomplete-item" data-code="${s.code}"><strong>${s.code}</strong> - ${s.name}</div>`).join(''); document.getElementById('autocomplete-suggestions').style.display = 'block'; } else { document.getElementById('autocomplete-suggestions').style.display = 'none'; } }, 250); }
function openCalculatorModal() { document.getElementById('modalCost').value = ''; document.getElementById('modalUnit').value = state.lastUsedUnitCount || '1'; document.getElementById('modalDiscount').value = state.lastUsedDiscount || '0'; document.getElementById('modalVat').value = state.lastUsedVat || '0'; $('#calculatorModal').modal('show'); }

// --- OTHER UTILITIES & STARTUP ---
function showLoginError(message) { dom.loginError.textContent = message; dom.loginError.style.display = 'block'; }
function getStatusSummary(request) { if (request.BranchConfirmTimestamp) return { badgeClass: 'badge-success', statusText: `✅ Confirmed` }; if (request.OfficerResponseTimestamp) return { badgeClass: 'badge-primary', statusText: `🔵 Awaiting Confirmation` }; if (request.itemsPending === 0 && request.itemsTotal > 0) return { badgeClass: 'badge-secondary', statusText: `☑️ Processed` }; return { badgeClass: 'badge-info', statusText: `⚠️ ${request.itemsPending} / ${state.requestList.length} Pending` }; }
function getStatusClass(status) { if (status === 'Pending') return 'badge-secondary'; if (status.includes('مراجعة') || status.includes('مسموع')) return 'badge-warning'; return 'badge-primary'; }
function displayMessage(message, isError = false, duration = 4000) { const toastContainer = document.getElementById('toast-container'); const toastId = 'toast-' + Date.now(); const toastHTML = `<div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true" data-delay="${duration}" data-autohide="true"><div class="toast-body">${message}</div></div>`; toastContainer.insertAdjacentHTML('beforeend', toastHTML); $('#' + toastId).toast('show').on('hidden.bs.toast', function(){ this.remove(); }); }
function showFullscreenNotification(event) { document.getElementById('fullscreen-notification-ok-btn').dataset.requestId = event.requestID; $('#fullscreen-notification-modal').modal('show'); }
function cacheDOMElements() { dom.loginView = document.getElementById('login-view'); dom.mainView = document.getElementById('main-view'); dom.loginForm = document.getElementById('login-form'); dom.loginCodeInput = document.getElementById('loginCode'); dom.loginError = document.getElementById('login-error'); dom.loadingIndicator = document.getElementById('loading-indicator'); dom.welcomeMessage = document.getElementById('welcome-message'); dom.logoutBtn = document.getElementById('logout-btn'); dom.notificationSound = document.getElementById('notification-sound'); dom.navButtons = document.getElementById('nav-buttons'); dom.appContentArea = document.getElementById('app-content-area'); }
function cacheAppDOMElements() { if (document.getElementById('branch-user-content')) { document.getElementById('add-to-list-btn').addEventListener('click', addToList); document.getElementById('code').addEventListener('input', handleCodeInput); document.getElementById('calc-btn').addEventListener('click', openCalculatorModal); document.getElementById('clear-list-btn').addEventListener('click', clearRequestList); document.getElementById('submit-all-btn').addEventListener('click', submitAllRequests); } }
function setupEventListeners() {
    dom.loginForm.addEventListener('submit', handleLogin);
    dom.logoutBtn.addEventListener('click', handleLogout);
    document.body.addEventListener('click', (e) => {
        const target = e.target; const navBtn = target.closest('#nav-buttons .btn'); if (navBtn) { document.querySelectorAll('#nav-buttons .btn').forEach(b => b.classList.remove('active')); navBtn.classList.add('active'); if(navBtn.id === 'nav-main-btn') showMainAppView(); if(navBtn.id === 'nav-reports-btn') showReportsView(); if(navBtn.id === 'nav-admin-btn') showAdminView(); return; }
        const toggleBtn = target.closest('.toggle-history-btn'); if (toggleBtn) { const container = toggleBtn.closest('.card-header').nextElementSibling; const isVisible = container.style.display !== 'none'; container.style.display = isVisible ? 'none' : 'block'; toggleBtn.innerHTML = isVisible ? '<i class="fas fa-eye"></i> Show' : '<i class="fas fa-eye-slash"></i> Hide'; return; }
        if (target.closest('#add-user-btn')) { openUserModal(); return; } if (target.closest('#save-user-btn')) { saveUser(); return; } if (target.closest('.edit-user-btn')) { openUserModal(JSON.parse(target.closest('.edit-user-btn').dataset.user)); return; } if (target.closest('.delete-user-btn')) { deleteUser(target.closest('.delete-user-btn').dataset.logincode); return; }
        if (target.closest('#generate-report-btn')) { generateActivityReport(); return; }
        if (target.closest('.review-btn')) { reviewRequest(target.closest('.review-btn').dataset.requestId); return; }
        if (target.closest('#branch-requests-table tr[data-request-id]')) { viewRequestDetails(target.closest('tr').dataset.requestId); return; }
        if (target.closest('#save-and-notify-btn')) { saveAndNotify(); return; } if (target.closest('#confirm-receipt-btn')) { confirmReceipt(); return; }
        if (target.closest('#fullscreen-notification-ok-btn')) { const requestId = target.dataset.requestId; $('#fullscreen-notification-modal').modal('hide'); if (requestId) viewRequestDetails(requestId); return; }
        if (target.closest('#export-officer-btn')) { exportModalAsJPG('officer-modal-body-exportable', 'request-details'); return; } if (target.closest('#export-branch-btn')) { exportModalAsJPG('branch-modal-body-exportable', 'request-history'); return; }
        if (target.closest('.autocomplete-item')) { selectAutocompleteItem(target.closest('.autocomplete-item').dataset.code); return; }
        if (target.closest('.remove-item-btn')) { removeFromList(target.closest('.remove-item-btn').dataset.index); return; }
    });
}
document.addEventListener('DOMContentLoaded', function() { cacheDOMElements(); setupEventListeners(); const storedUser = sessionStorage.getItem('currentUser'); if (storedUser) { state.currentUser = JSON.parse(storedUser); dom.loginCodeInput.value = state.currentUser.LoginCode; handleLogin(); } else { showView('login-view'); } });
