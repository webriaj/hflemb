// ---------- Global ----------
    let masterRows = [];
    let distinctTimes = [];
    let selectedTimesSet = new Set();
    let currentGroups = [];
    let currentAllSizes = [];
    let currentSelectedList = [];

    function escapeHtml(str) {
        if (!str) return "";
        return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
    }

    // Size sorter: numbers first, then custom alpha
    function sortSizes(sizeArray) {
        const customOrder = { 'S': 1, 'M': 2, 'L': 3, 'XL': 4, 'XXL': 5, 'XXXL': 6, '3XL': 6, '4XL': 7 };
        return sizeArray.sort((a,b) => {
            const aNum = parseFloat(a);
            const bNum = parseFloat(b);
            if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
            if (!isNaN(aNum)) return -1;
            if (!isNaN(bNum)) return 1;
            const orderA = customOrder[a.toUpperCase()] || 99;
            const orderB = customOrder[b.toUpperCase()] || 99;
            if (orderA !== orderB) return orderA - orderB;
            return a.localeCompare(b);
        });
    }

    // Aggregate: group by factory, buyer, style, po, color, cut, remarks, component (component now part of group key and displayed at top)
    function aggregateByGroupAndSizes(rows) {
        const groupMap = new Map();
        for (let row of rows) {
            const groupKey = `${row.factory}|${row.buyer}|${row.style}|${row.po}|${row.color}|${row.cut}|${row.remarks}|${row.component}`;
            const size = row.size;
            const bundles = row.numBundles;
            const qty = row.bundleQty;
            if (!groupMap.has(groupKey)) {
                groupMap.set(groupKey, {
                    factory: row.factory,
                    buyer: row.buyer,
                    style: row.style,
                    po: row.po,
                    color: row.color,
                    cut: row.cut,
                    remarks: row.remarks,
                    component: row.component,
                    sizeMap: new Map()
                });
            }
            const group = groupMap.get(groupKey);
            if (group.sizeMap.has(size)) {
                const existing = group.sizeMap.get(size);
                existing.bundles += bundles;
                existing.qty += qty;
            } else {
                group.sizeMap.set(size, { bundles, qty });
            }
        }
        const groups = Array.from(groupMap.values());
        const allSizesSet = new Set();
        for (let g of groups) {
            for (let sz of g.sizeMap.keys()) allSizesSet.add(sz);
        }
        let allSizes = Array.from(allSizesSet);
        allSizes = sortSizes(allSizes);
        // Sort groups: factory, buyer, style, po, color, cut, component
        groups.sort((a,b) => {
            if (a.factory !== b.factory) return a.factory.localeCompare(b.factory);
            if (a.buyer !== b.buyer) return a.buyer.localeCompare(b.buyer);
            if (a.style !== b.style) return a.style.localeCompare(b.style);
            if (a.po !== b.po) return a.po.localeCompare(b.po);
            if (a.color !== b.color) return a.color.localeCompare(b.color);
            if (a.cut !== b.cut) return a.cut.localeCompare(b.cut);
            return a.component.localeCompare(b.component);
        });
        return { groups, allSizes };
    }

    // Get unique factories and components from groups
    function getFactoryAndComponentString(groups) {
        const factorySet = new Set();
        const componentSet = new Set();
        for (let g of groups) {
            factorySet.add(g.factory);
            if (g.component) componentSet.add(g.component);
        }
        const factories = Array.from(factorySet).join(', ');
        const components = Array.from(componentSet).join(', ');
        return { factories, components };
    }

    // Build a single Gate Pass copy
    function buildSingleCopyHTML(groups, allSizes, selectedTimesList) {
        if (!groups.length) return '<div class="error">No data</div>';
        const { factories, components } = getFactoryAndComponentString(groups);
        const today = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
        
        let html = `
            <div style="margin-bottom: 25px; page-break-inside: avoid;">
                <div style="text-align:center; margin-bottom:6px;">
                    <h2 style="margin:0; font-size:1.2rem;">HABITUS FASHION LTD</h2>
                    <h3 style="margin:2px 0; font-size:1rem;">GATE PASS</h3>
                    <div class="send-to-line">Send to: ${escapeHtml(factories)} | Component: ${escapeHtml(components || '—')}</div>
                    <div style="display:flex; justify-content:space-between; margin-top:6px; font-size:0.7rem;">
                        <span><strong>Date:</strong> ${today}</span>
                        <span><strong>Timestamps:</strong> ${selectedTimesList.join(", ")}</span>
                    </div>
                </div>
                <div class="challan-wrapper">
                    <table class="challan-table">
                        <thead>
                            <tr>
                                <th rowspan="2">Buyer</th><th rowspan="2">Style</th><th rowspan="2">PO</th>
                                <th rowspan="2">Color</th><th rowspan="2">Cut No</th><th rowspan="2">Remarks</th>
                                ${allSizes.map(sz => `<th colspan="2" class="size-header-main">${escapeHtml(sz)}</th>`).join('')}
                            </tr>
                            <tr>
                                ${allSizes.map(() => `<th>Bundle</th><th>Qty</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
        `;
        for (let g of groups) {
            html += `<tr>`;
            html += `<td class="merged-cell">${escapeHtml(g.buyer)}<\/td>`;
            html += `<td class="merged-cell">${escapeHtml(g.style)}<\/td>`;
            html += `<td class="merged-cell">${escapeHtml(g.po)}<\/td>`;
            html += `<td class="merged-cell">${escapeHtml(g.color)}<\/td>`;
            html += `<td class="merged-cell">${escapeHtml(g.cut)}<\/td>`;
            // Editable remarks
            html += `<td class="merged-cell"><input type="text" class="remarks-input" data-groupkey="${escapeHtml(g.factory)}|${escapeHtml(g.buyer)}|${escapeHtml(g.style)}|${escapeHtml(g.component)}" value="${escapeHtml(g.remarks)}" style="width:120px;"><\/td>`;
            for (let sz of allSizes) {
                const data = g.sizeMap.get(sz);
                if (data) {
                    html += `<td>${data.bundles}<\/td><td>${data.qty}<\/td>`;
                } else {
                    html += `<td>-<\/td><td>-<\/td>`;
                }
            }
            html += `<\/tr>`;
        }
        // Total row
        html += `<tr class="total-row"><td colspan="6" style="text-align:right; font-weight:700;">GRAND TOTAL<\/td>`;
        for (let sz of allSizes) {
            let totalBundles = 0, totalQty = 0;
            for (let g of groups) {
                const d = g.sizeMap.get(sz);
                if (d) {
                    totalBundles += d.bundles;
                    totalQty += d.qty;
                }
            }
            html += `<td style="font-weight:700;">${totalBundles}<\/td><td style="font-weight:700;">${totalQty}<\/td>`;
        }
        html += `<\/tr>`;
        html += `</tbody></table></div>`;
        // Signature section
        html += `<div class="signature-section">
                    <div class="signature-line">_________________<br>Prepared by</div>
                    <div class="signature-line">_________________<br>Cutting Incharge/Manager</div>
                    <div class="signature-line">_________________<br>Store Officer</div>
                    <div class="signature-line">_________________<br>Authorised Sign</div>
                    <div class="signature-line">_________________<br>Print/Emb Receiver</div>
                    <div class="signature-line">_________________<br>Security Dept</div>
                </div>`;
        return html;
    }

    function renderDualChallan() {
        const container = document.getElementById("dualChallanContainer");
        if (!currentGroups.length) {
            container.style.display = "none";
            return;
        }
        const copy1 = buildSingleCopyHTML(currentGroups, currentAllSizes, currentSelectedList);
        const copy2 = buildSingleCopyHTML(currentGroups, currentAllSizes, currentSelectedList);
        const separator = `<div class="copy-separator"></div>`;
        container.innerHTML = copy1 + separator + copy2;
        container.style.display = "block";
        attachRemarksToBothCopies();
    }

    function attachRemarksToBothCopies() {
        const inputs = document.querySelectorAll('#dualChallanContainer .remarks-input');
        inputs.forEach(input => {
            input.removeEventListener('change', handleRemarksChange);
            input.addEventListener('change', handleRemarksChange);
        });
    }

    function handleRemarksChange(e) {
        const newRemarks = e.target.value;
        const row = e.target.closest('tr');
        if (!row) return;
        const cells = row.cells;
        if (cells.length < 6) return;
        const buyer = cells[0].innerText.trim();
        const style = cells[1].innerText.trim();
        const po = cells[2].innerText.trim();
        const color = cells[3].innerText.trim();
        const cut = cells[4].innerText.trim();
        // Find matching group
        const group = currentGroups.find(g => 
            g.buyer === buyer && g.style === style && g.po === po && g.color === color && g.cut === cut
        );
        if (group) {
            group.remarks = newRemarks;
            // Sync other copy
            const allInputs = document.querySelectorAll('#dualChallanContainer .remarks-input');
            for (let inp of allInputs) {
                if (inp !== e.target) {
                    const otherRow = inp.closest('tr');
                    if (otherRow) {
                        const otherBuyer = otherRow.cells[0].innerText.trim();
                        const otherStyle = otherRow.cells[1].innerText.trim();
                        const otherPo = otherRow.cells[2].innerText.trim();
                        const otherColor = otherRow.cells[3].innerText.trim();
                        const otherCut = otherRow.cells[4].innerText.trim();
                        if (otherBuyer === buyer && otherStyle === style && otherPo === po && otherColor === color && otherCut === cut) {
                            inp.value = newRemarks;
                        }
                    }
                }
            }
        }
    }

    function refreshAndRender() {
        if (!masterRows.length) return;
        const filteredRows = masterRows.filter(row => selectedTimesSet.has(row.time));
        if (!filteredRows.length) {
            document.getElementById("dualChallanContainer").innerHTML = '<div class="error">No records for selected timestamps.</div>';
            document.getElementById("dualChallanContainer").style.display = "block";
            document.getElementById("printBtn").style.display = "none";
            return;
        }
        const { groups, allSizes } = aggregateByGroupAndSizes(filteredRows);
        if (!groups.length) {
            document.getElementById("dualChallanContainer").innerHTML = '<div class="error">No groups found.</div>';
            document.getElementById("dualChallanContainer").style.display = "block";
            document.getElementById("printBtn").style.display = "none";
            return;
        }
        currentGroups = groups;
        currentAllSizes = allSizes;
        currentSelectedList = Array.from(selectedTimesSet).sort();
        renderDualChallan();
        document.getElementById("printBtn").style.display = "inline-block";
        document.getElementById("infoMsg").innerHTML = `✅ ${filteredRows.length} records → ${groups.length} groups. Sizes: ${allSizes.join(", ")}. Component at top.`;
    }

    // CSV parsing (including Component column)
    async function processCSV(file) {
        const loadingDiv = document.getElementById("loadingMsg");
        const errorDiv = document.getElementById("errorMsg");
        const timestampSection = document.getElementById("timestampSection");
        const dualContainer = document.getElementById("dualChallanContainer");
        const printBtn = document.getElementById("printBtn");
        
        loadingDiv.style.display = "block";
        errorDiv.style.display = "none";
        timestampSection.style.display = "none";
        dualContainer.style.display = "none";
        printBtn.style.display = "none";
        
        try {
            const text = await file.text();
            Papa.parse(text, {
                header: true,
                skipEmptyLines: true,
                transformHeader: h => h.trim(),
                complete: (results) => {
                    loadingDiv.style.display = "none";
                    const data = results.data;
                    if (!data || data.length === 0) {
                        errorDiv.style.display = "block";
                        errorDiv.innerText = "No data found.";
                        return;
                    }
                    const validRows = [];
                    const timeSet = new Set();
                    for (let obj of data) {
                        const time = obj.Time ? obj.Time.toString().trim() : "";
                        const factory = obj["Factory Name"] ? obj["Factory Name"].toString().trim() : "";
                        const buyer = obj.Buyer ? obj.Buyer.toString().trim() : "";
                        const style = obj.Style ? obj.Style.toString().trim() : "";
                        const po = obj.PO ? obj.PO.toString().trim() : "";
                        const color = obj.Color ? obj.Color.toString().trim() : "";
                        const cut = obj["Cutting No"] ? obj["Cutting No"].toString().trim() : "";
                        const size = obj.Size ? obj.Size.toString().trim() : "";
                        const numBundlesRaw = obj["Number of Bundles"] !== undefined ? obj["Number of Bundles"] : 0;
                        const bundleQtyRaw = obj["Bundle Qty"] !== undefined ? obj["Bundle Qty"] : 0;
                        const component = obj["Component Name"] ? obj["Component Name"].toString().trim() : "";
                        const remarks = obj.Remarks ? obj.Remarks.toString().trim() : "";
                        
                        if (!factory || !buyer || !style || !po || !color || !cut || !size) continue;
                        const numBundles = parseFloat(numBundlesRaw);
                        const bundleQty = parseFloat(bundleQtyRaw);
                        if (isNaN(numBundles) || isNaN(bundleQty)) continue;
                        
                        validRows.push({
                            time: time || "unknown",
                            factory, buyer, style, po, color, cut,
                            size, numBundles, bundleQty, component, remarks
                        });
                        if (time) timeSet.add(time);
                    }
                    if (validRows.length === 0) {
                        errorDiv.style.display = "block";
                        errorDiv.innerText = "No valid rows. Required: Factory Name, Buyer, Style, PO, Color, Cutting No, Size, Number of Bundles, Bundle Qty.";
                        return;
                    }
                    masterRows = validRows;
                    distinctTimes = Array.from(timeSet).sort((a,b) => a.localeCompare(b));
                    selectedTimesSet.clear();
                    distinctTimes.forEach(t => selectedTimesSet.add(t));
                    timestampSection.style.display = "block";
                    renderTimestampCheckboxes();
                    refreshAndRender();
                    document.getElementById("infoMsg").innerHTML = `✅ Loaded ${validRows.length} records. Component shown at top.`;
                },
                error: (err) => {
                    loadingDiv.style.display = "none";
                    errorDiv.style.display = "block";
                    errorDiv.innerText = "CSV error: " + err.message;
                }
            });
        } catch (err) {
            loadingDiv.style.display = "none";
            errorDiv.style.display = "block";
            errorDiv.innerText = "File error: " + err.message;
        }
    }

    function renderTimestampCheckboxes() {
        const container = document.getElementById("timestampCheckboxList");
        if (!container) return;
        container.innerHTML = "";
        distinctTimes.forEach(time => {
            const div = document.createElement("div");
            div.className = "checkbox-item";
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.value = time;
            cb.id = `ts_${time.replace(/[^a-zA-Z0-9]/g, '_')}`;
            cb.checked = selectedTimesSet.has(time);
            cb.addEventListener("change", (e) => {
                if (e.target.checked) selectedTimesSet.add(time);
                else selectedTimesSet.delete(time);
                refreshAndRender();
            });
            const label = document.createElement("label");
            label.htmlFor = cb.id;
            label.innerText = time;
            div.appendChild(cb);
            div.appendChild(label);
            container.appendChild(div);
        });
    }

    function selectAllTimes() {
        if (distinctTimes.length) {
            selectedTimesSet.clear();
            distinctTimes.forEach(t => selectedTimesSet.add(t));
            renderTimestampCheckboxes();
            refreshAndRender();
        }
    }
    function deselectAllTimes() {
        selectedTimesSet.clear();
        renderTimestampCheckboxes();
        refreshAndRender();
    }

    function printChallan() {
        const container = document.getElementById("dualChallanContainer");
        if (!container || !container.innerHTML || container.innerHTML.includes("No data")) {
            alert("No challan to print. Upload CSV and select timestamps.");
            return;
        }
        const cloneContainer = container.cloneNode(true);
        const inputs = cloneContainer.querySelectorAll('.remarks-input');
        inputs.forEach(inp => {
            const span = document.createElement('span');
            span.innerText = inp.value;
            span.style.fontWeight = 'normal';
            inp.parentNode.replaceChild(span, inp);
        });
        const printHtml = `
            <!DOCTYPE html>
            <html>
            <head><title>Habitus Fashion Ltd - Dual Gate Pass</title>
            <style>
                body { font-family: 'Segoe UI', Arial; margin: 0.2in; background: white; }
                .challan-table { width:100%; border-collapse: collapse; font-size: 9px; }
                .challan-table th, .challan-table td { border: 1px solid #000; padding: 4px; text-align: center; vertical-align: middle; }
                .merged-cell { background:#f9f2e0; }
                .total-row { background: #eef3fa; }
                .signature-section { display: flex; justify-content: space-between; margin-top: 25px; flex-wrap: wrap; font-size: 0.65rem; }
                .signature-line { text-align: center; min-width: 80px; }
                h2 { font-size: 1rem; margin: 0; }
                h3 { font-size: 0.85rem; margin: 2px 0; }
                .send-to-line { font-size:0.7rem; margin:4px 0; background:#fef4e8; display:inline-block; padding:2px 12px; border-radius:20px; }
                .copy-separator { margin: 0.2in 0; border-top: 1px dotted #000; }
            </style>
            </head>
            <body>${cloneContainer.innerHTML}</body>
            </html>
        `;
        const printWindow = window.open('', '_blank');
        if (!printWindow) { alert("Pop-up blocked. Allow pop-ups to print."); return; }
        printWindow.document.write(printHtml);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    }

    // Event binding
    const fileInput = document.getElementById("csvFile");
    const uploadBtn = document.getElementById("uploadBtn");
    const printBtn = document.getElementById("printBtn");
    const selectAllBtn = document.getElementById("selectAllTimesBtn");
    const deselectAllBtn = document.getElementById("deselectAllTimesBtn");
    
    uploadBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file && file.name.endsWith(".csv")) processCSV(file);
        else if (file) alert("Please select a CSV file.");
    });
    printBtn.addEventListener("click", printChallan);
    if (selectAllBtn) selectAllBtn.addEventListener("click", selectAllTimes);
    if (deselectAllBtn) deselectAllBtn.addEventListener("click", deselectAllTimes);C