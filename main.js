// --- CONFIGURATION ---
// IMPORTANT: Replace this URL with your own Google Apps Script deployment URL for the ReportingAppScript
const REPORTING_API_URL = 'https://script.google.com/macros/s/AKfycbynZLTpnkuNZVNngkRi_IJYXd-rPSy1LuUp9R1mZe7CMgAwyzJHjJqCqmZXsPhKye8/exec';

// --- GLOBAL STATE ---
let allBranches = [];
let allSuppliers = [];
const loadingOverlay = $('#loading-overlay');

// Report State
let itemReportDataTable;
let itemReportSelectionState = {};
let selectedBranchCodesForReport = [];
let selectedSupplierNamesForReport = [];

// --- BARCODE SCANNER STATE ---
let scannerStream = null;
let isScanning = false;
let scannerFacingMode = 'environment';
let barcodeDetector = null;
let scannerContext = null;

$(document).ready(function() {
    if (!currentUserData) return;
    loadingOverlay.addClass('active');
    initializeUI();
    initializeItemReportDataTable();
    attachEventListeners();
    initializeData();
});

function initializeUI() {
    $('#loggedInUser').text(currentUserData.username);
    if (!isBarcodeDetectionSupported()) {
        $('#itemReportScanBarcodeBtn').hide();
    } else {
        initializeBarcodeDetector();
    }
}

// Fetches all necessary data for the app to function
function initializeData() {
    Promise.all([
        fetchWithAction('getBranches'),
        fetchWithAction('getSuppliers')
    ]).then(([branches, suppliers]) => {
        allBranches = branches;
        allSuppliers = suppliers;
        populateFiltersAndModals();
        loadingOverlay.removeClass('active');
    }).catch(handleError);
}

function populateFiltersAndModals() {
    // Populate supplier filter dropdown
    const supplierSelect = $('#itemReportSupplierFilter');
    supplierSelect.empty().append(new Option('', ''));
    allSuppliers.forEach(s => supplierSelect.append(new Option(s, s)));
    supplierSelect.select2({ placeholder: "اختر مورد...", theme: "bootstrap-5", dir: "rtl", allowClear: true });

    // Populate branch selection modal
    const branchContainer = $('#branchListContainer');
    branchContainer.empty();
    allBranches.forEach(branch => {
        branchContainer.append(`<label class="list-group-item branch-item"><input class="form-check-input me-2" type="checkbox" value="${branch.code}">${branch.name}</label>`);
    });

    // Populate supplier selection modal
    const supplierContainer = $('#supplierListContainer');
    supplierContainer.empty();
    allSuppliers.forEach(supplier => {
        supplierContainer.append(`<label class="list-group-item supplier-item"><input class="form-check-input me-2" type="checkbox" value="${supplier}">${supplier}</label>`);
    });
}


function attachEventListeners() {
    // General
    $('#logoutBtn').on('click', () => { sessionStorage.removeItem('keroUser'); window.location.href = '../login/'; });

    // Update Stock Tab
    $('#updateStockBtn').on('click', handleStockUpdate);

    // Supplier Report Tab
    $('#openSupplierModalBtn').on('click', openSupplierSelectionModal);
    $('#saveSupplierSelectionBtn').on('click', saveSupplierSelection);
    $('#supplierSearchInput').on('keyup', filterSuppliersInModal);
    $('#modalSelectAllSuppliers').on('click', () => toggleAllSuppliersInModal(true));
    $('#modalDeselectAllSuppliers').on('click', () => toggleAllSuppliersInModal(false));
    $('#stockOperator').on('change', function() { $('#stockValue').prop('disabled', $(this).val() === 'all'); });
    $('#extractStockExcelBtn').on('click', () => handleExtractStock('excel'));
    $('#extractStockPdfBtn').on('click', () => handleExtractStock('pdf'));

    // Item Report Tab
    $('#itemReportSupplierFilter').on('change', () => performItemReportSearch({ supplier: $('#itemReportSupplierFilter').val() }));
    $('#itemReportSearchBtn').on('click', () => performItemReportSearch({ searchTerm: $('#itemReportSearchTerm').val() }));
    $('#itemReportSearchTerm').on('keypress', (e) => { if (e.which == 13) performItemReportSearch({ searchTerm: $('#itemReportSearchTerm').val() }); });
    $('#addItemToReportBtn').on('click', handleAddItemToReport);
    $('#clearItemReportSelectionBtn').on('click', clearItemReportSelection);
    $('#stockOperatorItems').on('change', function() { $('#stockValueItems').prop('disabled', $(this).val() === 'all'); });
    $('#extractItemsStockExcelBtn').on('click', () => handleExtractItemsStock('excel'));
    $('#extractItemsStockPdfBtn').on('click', () => handleExtractItemsStock('pdf'));
    $('#itemReportScanBarcodeBtn').on('click', () => openScanner({
        targetInput: '#itemReportSearchTerm',
        callbackFunction: performItemReportSearch
    }));

    // Shared Modals
    $('#openBranchModalBtn, #openBranchModalBtnItems').on('click', openBranchSelectionModal);
    $('#saveBranchSelectionBtn').on('click', saveBranchSelection);
    $('#branchSearchInput').on('keyup', filterBranchesInModal);
    $('#modalSelectAllBranches').on('click', () => toggleAllBranchesInModal(true));
    $('#modalDeselectAllBranches').on('click', () => toggleAllBranchesInModal(false));

    // PDF Print
    $('#printPdfBtn').on('click', () => { window.print(); });

    // Scanner
    $('#scannerSwitchBtn').on('click', switchScannerCamera);
    $('#barcode-scanner-modal').on('hidden.bs.modal', stopScanner);
}

// --- MODALS ---
function openBranchSelectionModal() { $('#branchListContainer .form-check-input').each(function() { $(this).prop('checked', selectedBranchCodesForReport.includes($(this).val())); }); new bootstrap.Modal('#branch-selection-modal').show(); }
function saveBranchSelection() { selectedBranchCodesForReport = []; $('#branchListContainer .form-check-input:checked').each(function() { selectedBranchCodesForReport.push($(this).val()); }); $('#branchSelectionCount').text(selectedBranchCodesForReport.length); $('#branchSelectionCountItems').text(selectedBranchCodesForReport.length); bootstrap.Modal.getInstance($('#branch-selection-modal')).hide(); }
function filterBranchesInModal() { const searchTerm = $('#branchSearchInput').val().toLowerCase(); $('#branchListContainer .branch-item').each(function() { $(this).toggle($(this).text().trim().toLowerCase().includes(searchTerm)); }); }
function toggleAllBranchesInModal(select) { $('#branchListContainer .branch-item:visible .form-check-input').prop('checked', select); }
function openSupplierSelectionModal() { $('#supplierListContainer .form-check-input').each(function() { $(this).prop('checked', selectedSupplierNamesForReport.includes($(this).val())); }); new bootstrap.Modal('#supplier-selection-modal').show(); }
function saveSupplierSelection() { selectedSupplierNamesForReport = []; $('#supplierListContainer .form-check-input:checked').each(function() { selectedSupplierNamesForReport.push($(this).val()); }); $('#supplierSelectionCount').text(selectedSupplierNamesForReport.length); bootstrap.Modal.getInstance($('#supplier-selection-modal')).hide(); }
function filterSuppliersInModal() { const searchTerm = $('#supplierSearchInput').val().toLowerCase(); $('#supplierListContainer .supplier-item').each(function() { $(this).toggle($(this).text().trim().toLowerCase().includes(searchTerm)); }); }
function toggleAllSuppliersInModal(select) { $('#supplierListContainer .supplier-item:visible .form-check-input').prop('checked', select); }

// --- ITEM REPORT TAB FUNCTIONS ---
function initializeItemReportDataTable() { itemReportDataTable = $('#itemReportTable').DataTable({ responsive: true, searching: false, lengthChange: false, info: false, paging: false, language: { "url": "//cdn.datatables.net/plug-ins/1.13.6/i18n/ar.json", "emptyTable": "لم يتم العثور على نتائج للبحث." }, data: [], columns: [{ data: null, defaultContent: '<input type="checkbox" class="form-check-input report-item-select">', orderable: false }, { data: 'name' }, { data: 'supplier_name' }], createdRow: function(row, data, dataIndex) { const cells = $(row).children('td'); $(cells[1]).attr('data-label', 'الاسم'); $(cells[2]).attr('data-label', 'المورد'); } }); }
function performItemReportSearch(params) { loadingOverlay.addClass('active'); if (params.searchTerm) { $('#itemReportSupplierFilter').val(null).trigger('change.select2'); } fetchWithAction('searchItems', params).then(data => { itemReportDataTable.clear().rows.add(data).draw(); $('#addItemToReportBtn').prop('disabled', data.length === 0); }).catch(handleError).finally(() => loadingOverlay.removeClass('active')); }
function handleAddItemToReport() { let itemsAdded = 0; itemReportDataTable.rows().every(function() { const node = $(this.node()); if (node.find('.report-item-select').is(':checked')) { const rowData = this.data(); if (!itemReportSelectionState[rowData.barcode]) { itemReportSelectionState[rowData.barcode] = rowData; itemsAdded++; } } }); if (itemsAdded > 0) { updateItemReportSummary(); itemReportDataTable.clear().draw(); $('#itemReportSearchTerm').val('').focus(); $('#addItemToReportBtn').prop('disabled', true); showToast(`تمت إضافة ${itemsAdded} صنف للتقرير.`); } else { alert("الرجاء تحديد صنف واحد على الأقل باستخدام مربع الاختيار."); } }
function updateItemReportSummary() { const count = Object.keys(itemReportSelectionState).length; const summaryContent = $('#itemReportSummaryContent'); $('#extractItemsStockExcelBtn, #extractItemsStockPdfBtn').prop('disabled', count === 0); if (count === 0) { summaryContent.html('<p class="placeholder-text text-center">الأصناف المختارة للتقرير ستظهر هنا.</p>'); return; } let listHtml = '<ul class="list-group list-group-flush">'; for (const barcode in itemReportSelectionState) { const item = itemReportSelectionState[barcode]; listHtml += `<li class="list-group-item" title="${item.name}">${item.name}</li>`; } listHtml += '</ul>'; summaryContent.html(listHtml); }
function clearItemReportSelection() { itemReportSelectionState = {}; updateItemReportSummary(); }
function handleExtractItemsStock(format) { if (selectedBranchCodesForReport.length === 0) { return alert("الرجاء اختيار فرع واحد على الأقل."); } const selectedItemBarcodes = Object.keys(itemReportSelectionState); if (selectedItemBarcodes.length === 0) { return alert("الرجاء اختيار صنف واحد على الأقل للتقرير."); } loadingOverlay.addClass('active'); const params = { branchCodes: selectedBranchCodesForReport.join(','), barcodes: selectedItemBarcodes.join(','), stockOperator: $('#stockOperatorItems').val(), stockValue: $('#stockValueItems').val() || 0 }; fetchWithAction('getItemStock', params).then(response => { if (!response.data || response.data.length === 0) { alert("لم يتم العثور على بيانات تطابق معايير البحث."); return; } if (format === 'excel') { const filename = `تقرير_رصيد_اصناف_${new Date().toISOString().slice(0,10)}.xlsx`; downloadDataAsExcel(response.data, filename, "تقرير الرصيد"); } else if (format === 'pdf') { renderPdfPreview(response); } }).catch(handleError).finally(() => loadingOverlay.removeClass('active')); }

// --- OTHER REPORTS & UTILITIES ---
function handleStockUpdate() { const file = $('#stockFile')[0].files[0]; if (!file) { alert("الرجاء اختيار ملف."); return; } loadingOverlay.addClass('active'); const reader = new FileReader(); reader.onload = function(e) { try { const data = new Uint8Array(e.target.result); const workbook = XLSX.read(data, { type: 'array' }); const sheet = workbook.Sheets[workbook.SheetNames[0]]; const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }); const cleanedData = jsonData.filter(row => row.length > 0 && row.some(cell => cell !== null && cell !== '')); if (cleanedData.length < 1) { throw new Error("الملف المرفوع فارغ أو يحتوي على صفوف فارغة فقط."); } const payload = { action: 'updateStock', username: currentUserData.username, data: cleanedData }; postWithAction(payload); } catch (err) { loadingOverlay.removeClass('active'); alert("خطأ في قراءة الملف: " + err.message); } }; reader.readAsArrayBuffer(file); }
function handleExtractStock(format) { if (selectedBranchCodesForReport.length === 0) { alert("الرجاء اختيار فرع واحد على الأقل."); return; } if (selectedSupplierNamesForReport.length === 0) { alert("الرجاء اختيار مورد واحد على الأقل."); return; } loadingOverlay.addClass('active'); const params = { branchCodes: selectedBranchCodesForReport.join(','), supplierNames: selectedSupplierNamesForReport.join(','), stockOperator: $('#stockOperator').val(), stockValue: $('#stockValue').val() || 0 }; fetchWithAction('getSupplierStock', params).then(response => { if (!response.data || response.data.length === 0) { alert("لم يتم العثور على بيانات تطابق معايير البحث."); return; } if (format === 'excel') { const filename = `تقرير_رصيد_الموردين_${new Date().toISOString().slice(0,10)}.xlsx`; downloadDataAsExcel(response.data, filename, "تقرير الرصيد"); } else if (format === 'pdf') { renderPdfPreview(response); } }).catch(handleError).finally(() => loadingOverlay.removeClass('active')); }
function downloadDataAsExcel(data, filename, sheetName = "البيانات") { const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, sheetName); XLSX.writeFile(wb, filename); }
function renderPdfPreview({ headers, data }) { let table = '<table class="table table-bordered table-striped table-sm">'; table += '<thead><tr>'; headers.forEach(h => table += `<th>${h}</th>`); table += '</tr></thead>'; table += '<tbody>'; data.forEach(row => { table += '<tr>'; headers.forEach(header => { table += `<td>${row[header] !== undefined ? row[header] : ''}</td>`; }); table += '</tr>'; }); table += '</tbody></table>'; const title = `تقرير رصيد - تاريخ: ${new Date().toLocaleDateString('ar-EG')}`; $('#pdf-preview-modal-title').text(title); $('#pdf-preview-modal-body').html(table).attr('data-print-title', title); new bootstrap.Modal('#pdf-preview-modal').show(); }
async function fetchWithAction(action, params = {}) { const url = new URL(REPORTING_API_URL); url.searchParams.append('action', action); for (const key in params) { if (params[key] !== null && params[key] !== undefined) { url.searchParams.append(key, params[key]); } } const response = await fetch(url); if (!response.ok) throw new Error(`Network error: ${response.statusText}`); const data = await response.json(); if (data.status === 'error') throw new Error(data.message); return data; }
async function postWithAction(payload = {}) { try { const response = await fetch(REPORTING_API_URL, { method: 'POST', body: JSON.stringify(payload) }); if (!response.ok) throw new Error(`Network error: ${response.statusText}`); const data = await response.json(); if (data.status === 'error') throw new Error(data.message); if (payload.action === 'updateStock') { loadingOverlay.removeClass('active'); $('#update-success').text(data.message).removeClass('d-none'); $('#update-error').addClass('d-none'); } return data; } catch (err) { handleError(err); } }
function handleError(error) { console.error('An error occurred:', error); loadingOverlay.removeClass('active'); alert('حدث خطأ: ' + error.message); }
function showToast(message) { const toastEl = $('<div class="toast align-items-center text-white bg-success border-0" role="alert" aria-live="assertive" aria-atomic="true"></div>'); toastEl.html(`<div class="d-flex"><div class="toast-body">${message}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>`); toastEl.css({ position: 'fixed', bottom: '20px', left: '20px', right: 'auto', zIndex: 1100 }); $('body').append(toastEl); const toast = new bootstrap.Toast(toastEl); toast.show(); toastEl.on('hidden.bs.toast', function() { $(this).remove(); }); }

// --- BARCODE SCANNER INTEGRATION ---
function openScanner(context) { if (!isBarcodeDetectionSupported()) return; scannerContext = context; startScanner(); }
function isBarcodeDetectionSupported() { return 'BarcodeDetector' in window; }
async function initializeBarcodeDetector() { try { const supportedFormats = await BarcodeDetector.getSupportedFormats(); if (supportedFormats.length > 0) { barcodeDetector = new BarcodeDetector({ formats: supportedFormats }); } else { $('#itemReportScanBarcodeBtn').hide(); console.warn("Barcode detection supported, but no formats available."); } } catch (err) { $('#itemReportScanBarcodeBtn').hide(); console.error("Error initializing BarcodeDetector:", err); } }
function startScanner() { $('#scanner-error').addClass('d-none'); new bootstrap.Modal('#barcode-scanner-modal').show(); startScannerCamera(); }
function stopStreamOnly() { if (scannerStream) { scannerStream.getTracks().forEach(track => track.stop()); } const video = $('#video-scanner')[0]; video.srcObject = null; scannerStream = null; }
async function startScannerCamera() { if (isScanning || !barcodeDetector) return; stopStreamOnly(); const constraints = { video: { facingMode: scannerFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } } }; try { scannerStream = await navigator.mediaDevices.getUserMedia(constraints); const video = $('#video-scanner')[0]; video.srcObject = scannerStream; await video.play(); isScanning = true; requestAnimationFrame(detectionLoop); } catch (err) { console.error("Camera error:", err); $('#scanner-error').text(`خطأ في الكاميرا: ${err.message}`).removeClass('d-none'); } }
function stopScanner() { isScanning = false; stopStreamOnly(); scannerContext = null; }
function switchScannerCamera() { scannerFacingMode = scannerFacingMode === 'environment' ? 'user' : 'environment'; startScannerCamera(); }
async function detectionLoop() { if (!isScanning) return; const video = $('#video-scanner')[0]; if (video.readyState >= 2) { try { const barcodes = await barcodeDetector.detect(video); if (barcodes.length > 0) { isScanning = false; handleBarcodeDetection(barcodes[0]); return; } } catch (error) { console.warn('Barcode detection error:', error); } } requestAnimationFrame(detectionLoop); }
function handleBarcodeDetection(barcode) { if (!scannerContext) return; if (barcode && barcode.rawValue) { navigator.vibrate(100); $(scannerContext.targetInput).val(barcode.rawValue); bootstrap.Modal.getInstance($('#barcode-scanner-modal')).hide(); scannerContext.callbackFunction({ searchTerm: barcode.rawValue }); } }
