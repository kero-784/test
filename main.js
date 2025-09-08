// --- CONFIGURATION ---
// IMPORTANT: Replace this URL with your own Google Apps Script deployment URL for the ResupplyAppScript
const RESUPPLY_API_URL = 'https://script.google.com/macros/s/AKfycbynZLTpnkuNZVNngkRi_IJYXd-rPSy1LuUp9R1mZe7CMgAwyzJHjJqCqmZXsPhKye8/exec';

// --- GLOBAL STATE ---
let currentBranch = null;
let allBranches = [];
let allSuppliers = [];
const loadingOverlay = $('#loading-overlay');
let suppliersInitialized = false;

// Order Tab State
let dataTable;
let selectionState = {};

// --- BARCODE SCANNER STATE ---
let scannerStream = null;
let isScanning = false;
let scannerFacingMode = 'environment';
let barcodeDetector = null;
let scannerContext = null;

$(document).ready(function() {
    if (!currentUserData) return;
    initializeUI();
    initializeDataTable();
    attachEventListeners();
    fetchBranches();
});

function initializeUI() {
    $('#loggedInUser').text(currentUserData.username);
    $('#search-container').addClass('disabled-overlay');
    $('#addItemsBtn').prop('disabled', true);

    if (!isBarcodeDetectionSupported()) {
        $('#scanBarcodeBtn').hide();
    } else {
        initializeBarcodeDetector();
    }
}

function attachEventListeners() {
    // General
    $('#logoutBtn').on('click', () => { sessionStorage.removeItem('keroUser'); window.location.href = '../login/'; });
    $('#branchSelect').on('change', handleBranchSelection);

    // Order Tab
    $('#supplierFilter').on('change', () => performSearch({ supplier: $('#supplierFilter').val() }));
    $('#searchBtn').on('click', () => performSearch({ searchTerm: $('#searchTerm').val() }));
    $('#searchTerm').on('keypress', (e) => { if (e.which == 13) performSearch({ searchTerm: $('#searchTerm').val() }); });
    $('#addItemsBtn').on('click', handleAddItems);
    $('#exportBtn').on('click', downloadOrderExcel);
    $('#scanBarcodeBtn').on('click', () => openScanner({
        targetInput: '#searchTerm',
        callbackFunction: performSearch
    }));

    // Scanner
    $('#scannerSwitchBtn').on('click', switchScannerCamera);
    $('#barcode-scanner-modal').on('hidden.bs.modal', stopScanner);
}

// --- INITIALIZATION & BRANCH SELECTION ---
function fetchBranches() { loadingOverlay.addClass('active'); fetchWithAction('getBranches').then(branches => { allBranches = branches; const userString = sessionStorage.getItem('keroUser'); const userData = JSON.parse(userString); const userBranchCode = userData.AssignedBranchCode; if (userBranchCode && allBranches.some(b => String(b.code) === String(userBranchCode))) { const assignedBranch = allBranches.find(b => String(b.code) === String(userBranchCode)); setBranch(assignedBranch); } else { const select = $('#branchSelect'); select.append(new Option('--- اختر فرع ---', '')); branches.forEach(b => select.append(new Option(b.name, b.code))); loadingOverlay.removeClass('active'); } }).catch(handleError); }
function setBranch(branch) { currentBranch = branch; $('#currentBranchName').text(currentBranch.name); $('#branch-selector-view').hide(); $('#main-content').removeClass('d-none'); $('#search-container').removeClass('disabled-overlay'); if (!suppliersInitialized) { initializeSuppliers(); } else { loadingOverlay.removeClass('active'); } }
function handleBranchSelection() { const selectedCode = $(this).val(); if (selectedCode) { loadingOverlay.addClass('active'); const selectedBranch = allBranches.find(b => b.code == selectedCode); setBranch(selectedBranch); } }
function initializeSuppliers() { fetchWithAction('getSuppliers').then(suppliers => { allSuppliers = suppliers; const supplierSelect = $('#supplierFilter'); supplierSelect.empty().append(new Option('', '')); suppliers.forEach(s => supplierSelect.append(new Option(s, s))); supplierSelect.select2({ placeholder: "اختر مورد...", theme: "bootstrap-5", dir: "rtl", allowClear: true }); suppliersInitialized = true; loadingOverlay.removeClass('active'); }).catch(handleError); }

// --- DATA FETCHING ---
function fetchData(params = {}) { if (!currentBranch) { alert("الرجاء اختيار فرع أولاً."); return Promise.reject("No branch selected"); } loadingOverlay.addClass('active'); params.branchCode = currentBranch.code; return fetchWithAction('searchItems', params); }

// --- ORDER TAB FUNCTIONS ---
function initializeDataTable() { dataTable = $('#itemsTable').DataTable({ responsive: true, searching: false, lengthChange: false, info: false, paging: false, language: { "url": "//cdn.datatables.net/plug-ins/1.13.6/i18n/ar.json", "emptyTable": "لم يتم العثور على نتائج للبحث." }, data: [], columns: [{ data: 'name' }, { data: 'supplier_name' }, { data: 'quantity' }, { data: null, defaultContent: '<input type="number" class="form-control form-control-sm order-quantity" min="1" placeholder="0">', orderable: false }], createdRow: function(row, data, dataIndex) { const cells = $(row).children('td'); $(cells[0]).attr('data-label', 'الاسم').addClass('td-name'); $(cells[1]).attr('data-label', 'المورد:').addClass('td-supplier'); const stockCell = $(cells[2]).attr('data-label', 'الكمية الحالية').addClass('td-stock'); const orderCell = $(cells[3]).attr('data-label', 'الكمية المطلوبة').addClass('td-order-qty'); if ($(window).width() < 768) { const container = $('<div class="mobile-qty-container"></div>'); const stockDiv = $('<div><label>الكمية الحالية</label></div>').append(stockCell.contents()); const orderDiv = $('<div><label>الكمية المطلوبة</label></div>').append(orderCell.contents()); container.append(stockDiv, orderDiv); stockCell.empty().append(container); orderCell.remove(); } } }); }
function performSearch(params) { if (params.searchTerm) { $('#supplierFilter').val(null).trigger('change.select2'); } fetchData(params).then(data => { dataTable.clear().rows.add(data).draw(); $('#addItemsBtn').prop('disabled', data.length === 0); }).catch(handleError).finally(() => loadingOverlay.removeClass('active')); }
function handleAddItems() { let itemsAdded = 0; dataTable.rows().every(function() { const rowData = this.data(); const quantity = parseInt($(this.node()).find('.order-quantity').val()); if (quantity > 0) { selectionState[rowData.barcode] = { itemData: rowData, quantity: quantity }; itemsAdded++; } }); if (itemsAdded > 0) { updateOrderSummary(); dataTable.clear().draw(); $('#searchTerm').val('').focus(); $('#addItemsBtn').prop('disabled', true); showToast(`تمت إضافة ${itemsAdded} صنف للطلب.`); } else { alert("لم يتم إدخال أي كميات."); } }
function updateOrderSummary() { const count = Object.keys(selectionState).length; $('#selectionCount').text(count); $('#exportBtn').prop('disabled', count === 0); const summaryContent = $('#order-summary-content'); if (count === 0) { summaryContent.html('<p class="placeholder-text text-center">الأصناف المختارة ستظهر هنا.</p>'); return; } let listHtml = '<ul id="order-summary-list" class="list-group list-group-flush">'; for (const barcode in selectionState) { const selection = selectionState[barcode]; listHtml += `<li class="list-group-item d-flex justify-content-between align-items-center"><span class="item-name" title="${selection.itemData.name}">${selection.itemData.name}</span><span class="badge bg-primary rounded-pill">${selection.quantity}</span></li>`; } listHtml += '</ul>'; summaryContent.html(listHtml); }
function getOrderDataForExport() { return Object.values(selectionState).map(sel => ({ "الباركود": sel.itemData.barcode, "الكود": sel.itemData.code, "الاسم": sel.itemData.name, "المورد": sel.itemData.supplier_name, "الكمية الحالية": sel.itemData.quantity, "الكمية المطلوبة": sel.quantity })); }
function downloadOrderExcel() { const branchName = currentBranch.name; const filename = `طلب_${branchName || 'بدون اسم'}_${new Date().toISOString().slice(0,10)}.xlsx`; const data = getOrderDataForExport(); downloadDataAsExcel(data, filename, "الطلب"); clearSelection(); }
function clearSelection() { selectionState = {}; updateOrderSummary(); dataTable.clear().draw(); $('#addItemsBtn').prop('disabled', true); }

// --- UTILITIES ---
function downloadDataAsExcel(data, filename, sheetName = "البيانات") { const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, sheetName); XLSX.writeFile(wb, filename); }
async function fetchWithAction(action, params = {}) { const url = new URL(RESUPPLY_API_URL); url.searchParams.append('action', action); for (const key in params) { if (params[key] !== null && params[key] !== undefined) { url.searchParams.append(key, params[key]); } } const response = await fetch(url); if (!response.ok) throw new Error(`Network error: ${response.statusText}`); const data = await response.json(); if (data.status === 'error') throw new Error(data.message); return data; }
function handleError(error) { console.error('An error occurred:', error); loadingOverlay.removeClass('active'); if (error.message.includes("No branch selected")) return; alert('حدث خطأ: ' + error.message); }
function showToast(message) { const toastEl = $('<div class="toast align-items-center text-white bg-success border-0" role="alert" aria-live="assertive" aria-atomic="true"></div>'); toastEl.html(`<div class="d-flex"><div class="toast-body">${message}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>`); toastEl.css({ position: 'fixed', bottom: '20px', left: '20px', right: 'auto', zIndex: 1100 }); $('body').append(toastEl); const toast = new bootstrap.Toast(toastEl); toast.show(); toastEl.on('hidden.bs.toast', function() { $(this).remove(); }); }

// --- BARCODE SCANNER INTEGRATION ---
function openScanner(context) { if (!isBarcodeDetectionSupported()) return; scannerContext = context; startScanner(); }
function isBarcodeDetectionSupported() { return 'BarcodeDetector' in window; }
async function initializeBarcodeDetector() { try { const supportedFormats = await BarcodeDetector.getSupportedFormats(); if (supportedFormats.length > 0) { barcodeDetector = new BarcodeDetector({ formats: supportedFormats }); } else { $('#scanBarcodeBtn').hide(); console.warn("Barcode detection supported, but no formats available."); } } catch (err) { $('#scanBarcodeBtn').hide(); console.error("Error initializing BarcodeDetector:", err); } }
function startScanner() { $('#scanner-error').addClass('d-none'); new bootstrap.Modal('#barcode-scanner-modal').show(); startScannerCamera(); }
function stopStreamOnly() { if (scannerStream) { scannerStream.getTracks().forEach(track => track.stop()); } const video = $('#video-scanner')[0]; video.srcObject = null; scannerStream = null; }
async function startScannerCamera() { if (isScanning || !barcodeDetector) return; stopStreamOnly(); const constraints = { video: { facingMode: scannerFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } } }; try { scannerStream = await navigator.mediaDevices.getUserMedia(constraints); const video = $('#video-scanner')[0]; video.srcObject = scannerStream; await video.play(); isScanning = true; requestAnimationFrame(detectionLoop); } catch (err) { console.error("Camera error:", err); $('#scanner-error').text(`خطأ في الكاميرا: ${err.message}`).removeClass('d-none'); } }
function stopScanner() { isScanning = false; stopStreamOnly(); scannerContext = null; }
function switchScannerCamera() { scannerFacingMode = scannerFacingMode === 'environment' ? 'user' : 'environment'; startScannerCamera(); }
async function detectionLoop() { if (!isScanning) return; const video = $('#video-scanner')[0]; if (video.readyState >= 2) { try { const barcodes = await barcodeDetector.detect(video); if (barcodes.length > 0) { isScanning = false; handleBarcodeDetection(barcodes[0]); return; } } catch (error) { console.warn('Barcode detection error:', error); } } requestAnimationFrame(detectionLoop); }
function handleBarcodeDetection(barcode) { if (!scannerContext) return; if (barcode && barcode.rawValue) { navigator.vibrate(100); $(scannerContext.targetInput).val(barcode.rawValue); bootstrap.Modal.getInstance($('#barcode-scanner-modal')).hide(); scannerContext.callbackFunction({ searchTerm: barcode.rawValue }); } }