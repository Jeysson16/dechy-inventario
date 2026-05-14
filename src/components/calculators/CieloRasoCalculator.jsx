import { useState, useMemo, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Real Product Dimensions ──────────────────────────────────────────────────
const PRODUCTS = {
  mainTee:    { name: "Te Principal",    dim: "32×24×3660×0.30mm", length: 3.66, unit: "pza" },
  longCross:  { name: "Te Secundaria",   dim: "25×24×1220×0.30mm", length: 1.22, unit: "pza" },
  shortCross: { name: "Te Terciaria",    dim: "25×24×610×0.30mm",  length: 0.61, unit: "pza" },
  wallAngle:  { name: "Ángulo Perimetral", dim: "22×19×3000×0.4mm", length: 3.00, unit: "pza" },
  tile:       { name: "Baldosa",         dim: "603×603×7mm",       size: 0.603,  unit: "u"   },
};

const MODULE = 0.61; // 610mm grid module

const TILE_OPTIONS = {
  "603x603": { w: 0.603, h: 0.603, label: "603×603mm (Est.)" },
  "603x1206": { w: 0.603, h: 1.206, label: "603×1206mm (Doble)" },
};

const SYSTEM_COLORS = {
  "T-Grid":       { main: "#6366f1", cross1: "#818cf8", cross2: "#c7d2fe", bg: "from-indigo-600 to-violet-600" },
  "Armstrong":    { main: "#0ea5e9", cross1: "#38bdf8", cross2: "#7dd3fc", bg: "from-sky-500 to-blue-600"     },
  "PVC":          { main: "#10b981", cross1: "#34d399", cross2: "#6ee7b7", bg: "from-emerald-500 to-teal-600" },
  "Fibra mineral":{ main: "#f59e0b", cross1: "#fbbf24", cross2: "#fcd34d", bg: "from-amber-500 to-orange-500" },
};

const UNIT_PRICES = {
  tile: 14.5, mainTee: 11.5, longCross: 4.8, shortCross: 2.9, wallAngle: 6.2, hanger: 2.5, wire: 0.8, anchor: 1.2,
};

// ─── Calculation Engine ───────────────────────────────────────────────────────
function calculate({ largo, ancho, tileType, system, waste, centered }) {
  const L = parseFloat(largo) || 0;
  const A = parseFloat(ancho) || 0;
  if (L <= 0 || A <= 0) return null;

  const { w: tileW, h: tileH } = TILE_OPTIONS[tileType] || TILE_OPTIONS["603x603"];
  const wasteF = (parseFloat(waste) || 0) / 100;

  const area = L * A;
  const perimeter = 2 * (L + A);

  // ── Tiles ──────────────────────────────────────────────────────────────────
  const tilesExact = (A / tileW) * (L / tileH);
  const totalTiles = Math.ceil(tilesExact * (1 + wasteF));

  const colCount = Math.ceil(A / tileW);
  const rowCount = Math.ceil(L / tileH);

  const offsetX = centered ? (A % tileW) / 2 : 0;
  const offsetY = centered ? (L % tileH) / 2 : 0;

  const edgeCols = A % tileW > 0.01 ? 2 : 0;
  const edgeRows = L % tileH > 0.01 ? 2 : 0;
  const cutTiles = Math.max(0, rowCount * edgeCols + colCount * edgeRows - (edgeCols * edgeRows > 0 ? 4 : 0));

  // ── Main Tees (3.66m) – run along "largo", spaced 1.22m along "ancho" ──────
  const mainTeeSpacing = PRODUCTS.longCross.length; // 1.22m
  const mainTeeLines   = Math.max(1, Math.round(A / mainTeeSpacing));
  const mainTeePiecesPerLine = Math.ceil(L / PRODUCTS.mainTee.length);
  const totalMainTees  = mainTeeLines * mainTeePiecesPerLine;

  // ── Long Cross / Secundaria (1.22m) – spans between adjacent main tees ─────
  const longCrossPositions  = Math.ceil(L / PRODUCTS.longCross.length);
  const longCrossPerPosition = mainTeeLines + 1; // spans incl. wall spans
  const totalLongCross = longCrossPositions * longCrossPerPosition;

  // ── Short Cross / Terciaria (0.61m) – at midpoints between long crosses ────
  const shortCrossPositions  = Math.max(0, Math.ceil(L / MODULE) - longCrossPositions);
  const shortCrossPerPosition = mainTeeLines + 1;
  const totalShortCross = shortCrossPositions * shortCrossPerPosition;

  // ── Wall Angle (3.0m) ──────────────────────────────────────────────────────
  const totalWallAngles = Math.ceil(perimeter / PRODUCTS.wallAngle.length);

  // ── Hangers / Suspenders ──────────────────────────────────────────────────
  const totalHangers = Math.ceil(area / 1.8); // 1 per 1.8m²
  const totalWire    = totalHangers * 2;
  const totalAnchors = totalHangers;

  // ── Cost ──────────────────────────────────────────────────────────────────
  const estimatedCost =
    totalTiles     * UNIT_PRICES.tile      +
    totalMainTees  * UNIT_PRICES.mainTee   +
    totalLongCross * UNIT_PRICES.longCross +
    totalShortCross * UNIT_PRICES.shortCross +
    totalWallAngles * UNIT_PRICES.wallAngle +
    totalHangers   * UNIT_PRICES.hanger    +
    totalWire      * UNIT_PRICES.wire      +
    totalAnchors   * UNIT_PRICES.anchor;

  return {
    area, perimeter,
    totalTiles, tilesExact, cutTiles,
    totalMainTees, mainTeeLines, mainTeePiecesPerLine,
    totalLongCross, longCrossPositions, longCrossPerPosition,
    totalShortCross, shortCrossPositions, shortCrossPerPosition,
    totalWallAngles, totalHangers, totalWire, totalAnchors,
    estimatedCost, colCount, rowCount, tileW, tileH, offsetX, offsetY,
    wastePercent: tilesExact > 0 ? Math.round(((totalTiles - tilesExact) / tilesExact) * 100) : 0,
  };
}

// ─── Draw Floor Plan (shared for SVG and PDF) ─────────────────────────────────
function buildFloorPlanData(inputs, results, scale) {
  const { largo, ancho, centered } = inputs;
  const L = parseFloat(largo) || 0;
  const A = parseFloat(ancho) || 0;
  const { tileW, tileH, colCount, rowCount, offsetX, offsetY } = results;

  const tiles = [];
  for (let row = 0; row < rowCount; row++) {
    for (let col = 0; col < colCount; col++) {
      const tileX = offsetX + col * tileW;
      const tileY = offsetY + row * tileH;
      const w = Math.min(tileW, A - tileX) * scale;
      const h = Math.min(tileH, L - tileY) * scale;
      const isCut = A - tileX < tileW - 0.001 || L - tileY < tileH - 0.001;
      if (w > 0.5 && h > 0.5) {
        tiles.push({ px: tileX * scale, py: tileY * scale, w, h, isCut, row, col });
      }
    }
  }

  const mainTeeLines = [];
  for (let i = 0; i <= Math.ceil(A / tileW); i++) {
    const x = i * tileW * scale;
    if (x > A * scale + 0.5) break;
    mainTeeLines.push({ x1: Math.min(x, A * scale), y1: 0, x2: Math.min(x, A * scale), y2: L * scale });
  }

  const crossTeeLines = [];
  for (let j = 0; j <= Math.ceil(L / tileH); j++) {
    const y = j * tileH * scale;
    if (y > L * scale + 0.5) break;
    crossTeeLines.push({ x1: 0, y1: Math.min(y, L * scale), x2: A * scale, y2: Math.min(y, L * scale) });
  }

  return { tiles, mainTeeLines, crossTeeLines, roomW: A * scale, roomH: L * scale };
}

// ─── SVG Floor Plan ───────────────────────────────────────────────────────────
function FloorPlanSVG({ inputs, results, colors }) {
  const L = parseFloat(inputs.largo) || 0;
  const A = parseFloat(inputs.ancho) || 0;

  if (!results || L <= 0 || A <= 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-14 h-14 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
        <p className="text-sm font-medium">Ingrese dimensiones para ver el plano</p>
      </div>
    );
  }

  const PAD = 46;
  const SVG_W = 720;
  const SVG_H = 500;
  const scale = Math.min((SVG_W - PAD * 2) / A, (SVG_H - PAD * 2) / L, 160);
  const { tiles, mainTeeLines, crossTeeLines, roomW, roomH } = buildFloorPlanData(inputs, results, scale);
  const ox = PAD + ((SVG_W - PAD * 2) - roomW) / 2;
  const oy = PAD + ((SVG_H - PAD * 2) - roomH) / 2;

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-full" style={{ maxHeight: 500 }}>
      <defs>
        <pattern id="hatching" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#f97316" strokeWidth="1.5" opacity="0.45" />
        </pattern>
        <pattern id="bg-dots" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="8" cy="8" r="0.7" fill="#e2e8f0" />
        </pattern>
      </defs>

      <rect width={SVG_W} height={SVG_H} fill="#f8fafc" rx="10" />
      <rect width={SVG_W} height={SVG_H} fill="url(#bg-dots)" rx="10" />

      {/* Room drop shadow */}
      <rect x={ox + 3} y={oy + 3} width={roomW} height={roomH} fill="rgba(0,0,0,0.07)" rx="2" />

      {/* Full tiles */}
      {tiles.filter(t => !t.isCut).map((t, i) => (
        <rect key={i} x={ox + t.px} y={oy + t.py} width={t.w} height={t.h} fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.4" />
      ))}

      {/* Cut tiles */}
      {tiles.filter(t => t.isCut).map((t, i) => (
        <g key={`c${i}`}>
          <rect x={ox + t.px} y={oy + t.py} width={t.w} height={t.h} fill="url(#hatching)" />
          <rect x={ox + t.px} y={oy + t.py} width={t.w} height={t.h} fill="#fff7ed" opacity="0.7" />
          <rect x={ox + t.px} y={oy + t.py} width={t.w} height={t.h} fill="none" stroke="#f97316" strokeWidth="0.6" />
        </g>
      ))}

      {/* Long/Short Cross Tees */}
      {crossTeeLines.map((l, i) => (
        <line key={`ct${i}`} x1={ox + l.x1} y1={oy + l.y1} x2={ox + l.x2} y2={oy + l.y2}
          stroke={i % 2 === 0 ? colors.cross1 : colors.cross2} strokeWidth={i % 2 === 0 ? "1.2" : "0.7"} strokeDasharray={i % 2 === 0 ? "none" : "4 3"} />
      ))}

      {/* Main Tees */}
      {mainTeeLines.map((l, i) => (
        <line key={`mt${i}`} x1={ox + l.x1} y1={oy + l.y1} x2={ox + l.x2} y2={oy + l.y2}
          stroke={colors.main} strokeWidth="2" />
      ))}

      {/* Room border */}
      <rect x={ox} y={oy} width={roomW} height={roomH} fill="none" stroke="#1e293b" strokeWidth="2.5" />
      {/* Wall angle (dashed offset) */}
      <rect x={ox - 5} y={oy - 5} width={roomW + 10} height={roomH + 10} fill="none" stroke="#64748b" strokeWidth="3.5" strokeDasharray="8 5" rx="2" opacity="0.35" />

      {/* Hanger dots at main tee / cross tee intersections */}
      {mainTeeLines.map((mt, mi) =>
        crossTeeLines.filter((_, ci) => ci % 2 === 0).map((ct, ci) => {
          const px = ox + mt.x1, py = oy + ct.y1;
          if (px < ox || px > ox + roomW || py < oy || py > oy + roomH) return null;
          return <circle key={`h${mi}-${ci}`} cx={px} cy={py} r="2.8" fill="#ef4444" opacity="0.55" />;
        })
      )}

      {/* Dimensions */}
      <line x1={ox} y1={oy - 24} x2={ox + roomW} y2={oy - 24} stroke="#475569" strokeWidth="1.2" />
      <line x1={ox} y1={oy - 30} x2={ox} y2={oy - 18} stroke="#475569" strokeWidth="1.2" />
      <line x1={ox + roomW} y1={oy - 30} x2={ox + roomW} y2={oy - 18} stroke="#475569" strokeWidth="1.2" />
      <text x={ox + roomW / 2} y={oy - 29} textAnchor="middle" fill="#1e293b" fontSize="11" fontWeight="800" fontFamily="system-ui">
        Ancho: {A.toFixed(2)} m
      </text>

      <line x1={ox - 28} y1={oy} x2={ox - 28} y2={oy + roomH} stroke="#475569" strokeWidth="1.2" />
      <text x={ox - 36} y={oy + roomH / 2} textAnchor="middle" fill="#1e293b" fontSize="11" fontWeight="800" fontFamily="system-ui"
        transform={`rotate(-90, ${ox - 36}, ${oy + roomH / 2})`}>
        Largo: {L.toFixed(2)} m
      </text>

      {/* Area label */}
      <rect x={ox + roomW / 2 - 36} y={oy + roomH / 2 - 11} width={72} height={21} fill="rgba(15,23,42,0.78)" rx="5" />
      <text x={ox + roomW / 2} y={oy + roomH / 2 + 4} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="800" fontFamily="system-ui">
        {(L * A).toFixed(2)} m²
      </text>

      {/* Legend */}
      <g transform={`translate(${SVG_W - 178}, ${SVG_H - 126})`}>
        <rect width={168} height={118} rx="8" fill="white" opacity="0.93" stroke="#e2e8f0" strokeWidth="1" />
        <text x={10} y={17} fontSize="9" fontWeight="800" fill="#475569" fontFamily="system-ui">LEYENDA</text>
        <rect x={10} y={23} width={14} height={10} fill="#fff" stroke="#cbd5e1" />
        <text x={30} y={32} fontSize="8.5" fill="#64748b" fontFamily="system-ui">Baldosa completa</text>
        <rect x={10} y={39} width={14} height={10} fill="#fff7ed" stroke="#f97316" />
        <text x={30} y={48} fontSize="8.5" fill="#64748b" fontFamily="system-ui">Baldosa cortada</text>
        <line x1={10} y1={62} x2={24} y2={62} stroke={colors.main} strokeWidth="2.5" />
        <text x={30} y={65} fontSize="8.5" fill="#64748b" fontFamily="system-ui">Te Principal (3.66m)</text>
        <line x1={10} y1={78} x2={24} y2={78} stroke={colors.cross1} strokeWidth="1.5" />
        <text x={30} y={81} fontSize="8.5" fill="#64748b" fontFamily="system-ui">Te Secundaria (1.22m)</text>
        <line x1={10} y1={93} x2={24} y2={93} stroke={colors.cross2} strokeWidth="1" strokeDasharray="4 3" />
        <text x={30} y={96} fontSize="8.5" fill="#64748b" fontFamily="system-ui">Te Terciaria (0.61m)</text>
        <circle cx={17} cy={110} r="3" fill="#ef4444" opacity="0.6" />
        <text x={30} y={113} fontSize="8.5" fill="#64748b" fontFamily="system-ui">Suspensor</text>
      </g>

      {/* Scale bar */}
      {scale >= 40 && (
        <>
          <line x1={ox} y1={oy + roomH + 16} x2={ox + scale} y2={oy + roomH + 16} stroke="#94a3b8" strokeWidth="1.5" />
          <text x={ox + scale / 2} y={oy + roomH + 28} textAnchor="middle" fill="#94a3b8" fontSize="8" fontFamily="system-ui">1 m</text>
        </>
      )}
    </svg>
  );
}

// ─── PDF Floor Plan (drawn with jsPDF primitives) ─────────────────────────────
function drawPDFFloorPlan(doc, inputs, results, startX, startY, maxW, maxH) {
  const L = parseFloat(inputs.largo) || 0;
  const A = parseFloat(inputs.ancho) || 0;
  if (L <= 0 || A <= 0) return;

  const scale = Math.min(maxW / A, maxH / L, 90);
  const { tiles, mainTeeLines, crossTeeLines, roomW, roomH } = buildFloorPlanData(inputs, results, scale);
  const ox = startX + (maxW - roomW) / 2;
  const oy = startY;

  // Full tiles
  doc.setLineWidth(0.2);
  tiles.filter(t => !t.isCut).forEach(t => {
    doc.setFillColor(248, 250, 255);
    doc.setDrawColor(203, 213, 225);
    doc.rect(ox + t.px, oy + t.py, t.w, t.h, "FD");
  });

  // Cut tiles
  tiles.filter(t => t.isCut).forEach(t => {
    doc.setFillColor(255, 247, 237);
    doc.setDrawColor(249, 115, 22);
    doc.setLineWidth(0.4);
    doc.rect(ox + t.px, oy + t.py, t.w, t.h, "FD");
  });

  // Short cross tees (dashed, lighter)
  doc.setLineWidth(0.35);
  doc.setDrawColor(196, 181, 253);
  crossTeeLines.filter((_, i) => i % 2 !== 0).forEach(l => {
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.line(ox + l.x1, oy + l.y1, ox + l.x2, oy + l.y2);
  });

  // Long cross tees
  doc.setLineWidth(0.5);
  doc.setDrawColor(129, 140, 248);
  doc.setLineDashPattern([], 0);
  crossTeeLines.filter((_, i) => i % 2 === 0).forEach(l => {
    doc.line(ox + l.x1, oy + l.y1, ox + l.x2, oy + l.y2);
  });

  // Main tees
  doc.setLineWidth(1.0);
  doc.setDrawColor(99, 102, 241);
  doc.setLineDashPattern([], 0);
  mainTeeLines.forEach(l => {
    doc.line(ox + l.x1, oy + l.y1, ox + l.x2, oy + l.y2);
  });

  // Wall angle (dashed outer border)
  doc.setLineWidth(1.8);
  doc.setDrawColor(100, 116, 139);
  doc.setLineDashPattern([3, 2], 0);
  doc.rect(ox - 3, oy - 3, roomW + 6, roomH + 6);

  // Room border
  doc.setLineWidth(1.2);
  doc.setDrawColor(30, 41, 59);
  doc.setLineDashPattern([], 0);
  doc.rect(ox, oy, roomW, roomH);

  // Dimension labels
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`${A.toFixed(2)} m`, ox + roomW / 2, oy - 6, { align: "center" });
  doc.text(`${L.toFixed(2)} m`, ox - 5, oy + roomH / 2, { align: "center", angle: 90 });

  // Area center label
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(ox + roomW / 2 - 15, oy + roomH / 2 - 6, 30, 10, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(`${(L * A).toFixed(1)}m²`, ox + roomW / 2, oy + roomH / 2 + 2, { align: "center" });
  doc.setTextColor(0, 0, 0);

  // Legend (small)
  const lx = ox + roomW + 5;
  const ly = oy;
  if (lx + 50 < startX + maxW + 55) {
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    [[99, 102, 241, "T.Principal"], [129, 140, 248, "T.Secundaria"],
     [196, 181, 253, "T.Terciaria"], [249, 115, 22, "Corte"]].forEach(([r, g, b, label], idx) => {
      doc.setFillColor(r, g, b);
      doc.rect(lx, ly + idx * 9, 6, 4, "F");
      doc.text(label, lx + 8, ly + idx * 9 + 3.5);
    });
  }
}

// ─── Excel Export ─────────────────────────────────────────────────────────────
async function exportExcel(inputs, results) {
  if (!results) return;
  const ExcelJS = (await import("exceljs")).default;
  const { saveAs } = await import("file-saver");

  const wb = new ExcelJS.Workbook();
  wb.creator = "Dechy Inventario";
  wb.created = new Date();

  const blue = "FF6366F1", lightBlue = "FFC7D2FE", orange = "FFFED7AA",
    white = "FFFFFFFF", dark = "FF1E293B", lightBg = "FFF8FAFC", indigo = "FF818CF8";

  // ── Sheet 1: Resumen ──────────────────────────────────────────────────────
  const s1 = wb.addWorksheet("Resumen");
  s1.getColumn("A").width = 30; s1.getColumn("B").width = 22;
  s1.getRow(1).height = 32;
  const titleCell = s1.getCell("A1");
  titleCell.value = "CALCULADORA DE CIELO RASO MODULAR";
  titleCell.font = { bold: true, size: 14, color: { argb: "FF6366F1" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: lightBg } };
  s1.mergeCells("A1:B1");

  s1.addRow([]);
  s1.addRow(["DATOS DEL AMBIENTE", "VALOR"]).eachCell(c => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: dark } };
  });

  [["Largo", `${inputs.largo} m`], ["Ancho", `${inputs.ancho} m`],
   ["Área Total", `${results.area.toFixed(2)} m²`], ["Perímetro", `${results.perimeter.toFixed(2)} m`],
   ["Sistema", inputs.system], ["Tipo Baldosa", inputs.tileType],
   ["% Desperdicio", `${inputs.waste}%`], ["Altura", `${inputs.height} m`],
  ].forEach(([k, v]) => {
    const r = s1.addRow([k, v]);
    r.getCell(1).font = { bold: true };
    r.getCell(2).font = { color: { argb: "FF6366F1" }, bold: true };
    r.eachCell(c => {
      c.border = { bottom: { style: "thin", color: { argb: "FFE2E8F0" } } };
    });
  });

  s1.addRow([]);
  s1.addRow(["RESUMEN DE MATERIALES", "CANTIDAD"]).eachCell(c => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF10b981" } };
  });

  [
    [`Baldosas (${PRODUCTS.tile.dim})`, results.totalTiles],
    [`Te Principal (${PRODUCTS.mainTee.dim})`, results.totalMainTees],
    [`Te Secundaria (${PRODUCTS.longCross.dim})`, results.totalLongCross],
    [`Te Terciaria (${PRODUCTS.shortCross.dim})`, results.totalShortCross],
    [`Ángulo Perimetral (${PRODUCTS.wallAngle.dim})`, results.totalWallAngles],
    ["Suspensores", results.totalHangers],
    ["Alambre galvanizado (m)", results.totalWire],
    ["Anclajes/Tarugos", results.totalAnchors],
  ].forEach(([k, v]) => {
    const r = s1.addRow([k, v]);
    r.getCell(2).font = { bold: true };
    r.getCell(2).alignment = { horizontal: "right" };
  });

  const totalRow = s1.addRow(["COSTO ESTIMADO TOTAL", `S/ ${results.estimatedCost.toFixed(2)}`]);
  totalRow.eachCell(c => {
    c.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF10b981" } };
  });

  // ── Sheet 2: Materiales Detalle ────────────────────────────────────────────
  const s2 = wb.addWorksheet("Lista de Materiales");
  ["A","B","C","D","E","F"].forEach((col, i) => {
    s2.getColumn(col).width = [35, 28, 12, 12, 15, 18][i];
  });

  const h2 = s2.addRow(["Material", "Especificaciones", "Cantidad", "Unid.", "P.Unit.(S/)", "Total (S/)"]);
  h2.height = 22;
  h2.eachCell(c => {
    c.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: blue } };
    c.alignment = { vertical: "middle", horizontal: "center" };
    c.border = { bottom: { style: "medium", color: { argb: blue } } };
  });

  const rows2 = [
    ["Baldosa", PRODUCTS.tile.dim, results.totalTiles, "u", UNIT_PRICES.tile],
    ["Te Principal", PRODUCTS.mainTee.dim, results.totalMainTees, "pza", UNIT_PRICES.mainTee],
    ["Te Secundaria", PRODUCTS.longCross.dim, results.totalLongCross, "pza", UNIT_PRICES.longCross],
    ["Te Terciaria", PRODUCTS.shortCross.dim, results.totalShortCross, "pza", UNIT_PRICES.shortCross],
    ["Ángulo Perimetral", PRODUCTS.wallAngle.dim, results.totalWallAngles, "pza", UNIT_PRICES.wallAngle],
    ["Suspensores", "Con clip metálico", results.totalHangers, "u", UNIT_PRICES.hanger],
    ["Alambre galvanizado", "Calibre 16", results.totalWire, "m", UNIT_PRICES.wire],
    ["Anclajes / Tarugos", "Fijación techo", results.totalAnchors, "u", UNIT_PRICES.anchor],
  ];

  rows2.forEach(([name, spec, qty, unit, price], idx) => {
    const r = s2.addRow([name, spec, qty, unit, price.toFixed(2), (qty * price).toFixed(2)]);
    r.height = 18;
    const bg = idx % 2 === 0 ? "FFFFFFFF" : "FFF8FAFC";
    r.eachCell(c => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      c.border = { bottom: { style: "thin", color: { argb: "FFE2E8F0" } } };
    });
    r.getCell(3).font = { bold: true, color: { argb: blue } };
    r.getCell(6).font = { bold: true };
  });

  const tot2 = s2.addRow(["", "", "", "", "TOTAL ESTIMADO", `S/ ${results.estimatedCost.toFixed(2)}`]);
  tot2.height = 22;
  tot2.eachCell(c => {
    c.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF10b981" } };
  });

  s2.addRow([]);
  s2.addRow(["* Los precios son referenciales. Validar con proveedor antes de adquirir."]).getCell(1).font = {
    italic: true, size: 8, color: { argb: "FF94A3B8" },
  };

  // ── Sheet 3: Plano Visual (coloreado) ─────────────────────────────────────
  const s3 = wb.addWorksheet("Plano Visual");
  const { colCount, rowCount, tileW, tileH, offsetX, offsetY } = results;
  const L = parseFloat(inputs.largo);
  const A = parseFloat(inputs.ancho);

  const CELL_W = 4.5;
  const CELL_H = 18;

  // Title
  s3.getCell(1, 1).value = `Plano Visual – ${A}m × ${L}m | Baldosa: ${inputs.tileType} | Sistema: ${inputs.system}`;
  s3.getCell(1, 1).font = { bold: true, size: 11, color: { argb: blue } };
  s3.mergeCells(1, 1, 1, colCount + 2);
  s3.getRow(1).height = 20;
  s3.getRow(2).height = 8; // spacer

  for (let row = 0; row < rowCount; row++) {
    const excelRow = row + 3; // offset 2 for header + 1-indexed
    s3.getRow(excelRow).height = CELL_H;

    for (let col = 0; col < colCount; col++) {
      const excelCol = col + 1;
      s3.getColumn(excelCol).width = CELL_W;

      const tileX = offsetX + col * tileW;
      const tileY = offsetY + row * tileH;
      const isCutRight = A - tileX < tileW - 0.001;
      const isCutBottom = L - tileY < tileH - 0.001;
      const isCut = isCutRight || isCutBottom;

      // Is this tile in a main tee position (every 2nd col)?
      const isMainTeeCol = Math.abs(tileX % (tileW * 2)) < 0.01;

      const cell = s3.getCell(excelRow, excelCol);
      cell.fill = {
        type: "pattern", pattern: "solid",
        fgColor: { argb: isCut ? orange : isMainTeeCol ? lightBlue : white },
      };
      cell.border = {
        top: { style: "thin", color: { argb: isCut ? "FFF97316" : "FFE2E8F0" } },
        left: { style: isCut ? "thin" : "hair", color: { argb: isCut ? "FFF97316" : "FFCBD5E1" } },
        bottom: { style: "thin", color: { argb: isCut ? "FFF97316" : "FFE2E8F0" } },
        right: { style: isCut ? "thin" : "hair", color: { argb: isCut ? "FFF97316" : "FFCBD5E1" } },
      };

      if (isCut) cell.value = "✂";
    }

    // Row label on the right
    const labelCell = s3.getCell(excelRow, colCount + 2);
    labelCell.value = `F${row + 1}`;
    labelCell.font = { size: 7, color: { argb: "FF94A3B8" } };
    s3.getColumn(colCount + 2).width = 5;
  }

  // Column labels at top
  for (let col = 0; col < colCount; col++) {
    const labelCell = s3.getCell(2, col + 1);
    labelCell.value = col + 1;
    labelCell.font = { size: 7, color: { argb: "FF94A3B8" } };
    labelCell.alignment = { horizontal: "center" };
    s3.getRow(2).height = 12;
  }

  // Legend at bottom
  const legendRow = rowCount + 5;
  [[white, "Baldosa completa"], [orange, "Baldosa cortada (corte)"], [lightBlue, "Posición Te Principal"], [indigo, "Te Secundaria"]].forEach(([color, label], i) => {
    const c = s3.getCell(legendRow + i, 1);
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
    c.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    s3.getCell(legendRow + i, 2).value = label;
    s3.getCell(legendRow + i, 2).font = { size: 9 };
    s3.getRow(legendRow + i).height = 16;
  });

  const buf = await wb.xlsx.writeBuffer();
  const { saveAs: save } = await import("file-saver");
  save(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `cielo-raso-${inputs.largo}x${inputs.ancho}-${inputs.system}.xlsx`);
}

// ─── PDF Export ───────────────────────────────────────────────────────────────
function exportPDF(inputs, results) {
  if (!results) return;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = 210, PH = 297, M = 14;

  // Cover gradient bar
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, PW, 28, "F");

  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("Calculadora de Cielo Raso Modular", M, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Sistema: ${inputs.system}  |  Baldosa: ${inputs.tileType}  |  ${new Date().toLocaleDateString("es-PE")}`, M, 20);

  // Project summary table
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.text("Datos del Ambiente", M, 36);

  autoTable(doc, {
    startY: 39,
    head: [["Parámetro", "Valor"]],
    body: [
      ["Largo", `${inputs.largo} m`],
      ["Ancho", `${inputs.ancho} m`],
      ["Área Total", `${results.area.toFixed(2)} m²`],
      ["Perímetro", `${results.perimeter.toFixed(2)} m`],
      ["Sistema de instalación", inputs.system],
      ["Tipo de baldosa", `${inputs.tileType} (${PRODUCTS.tile.dim})`],
      ["Porcentaje de desperdicio", `${inputs.waste}%`],
      ["Módulo de cuadrícula", "610mm"],
    ],
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: [99, 102, 241], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 255] },
    columnStyles: { 1: { fontStyle: "bold", textColor: [99, 102, 241] } },
    margin: { left: M, right: M },
  });

  // Floor plan section
  const planY = doc.lastAutoTable.finalY + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text("Plano Técnico 2D", M, planY);

  const planMaxW = PW - M * 2 - 58;
  const planMaxH = 80;
  drawPDFFloorPlan(doc, inputs, results, M, planY + 4, planMaxW, planMaxH);

  // Materials table on page 2
  doc.addPage();

  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, PW, 16, "F");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("Lista de Materiales Detallada", M, 11);

  autoTable(doc, {
    startY: 22,
    head: [["Material", "Especificaciones", "Cant.", "Unid.", "P.Unit.", "Total"]],
    body: [
      [PRODUCTS.tile.name,       PRODUCTS.tile.dim,       results.totalTiles,       "u",   `S/${UNIT_PRICES.tile}`,       `S/${(results.totalTiles * UNIT_PRICES.tile).toFixed(2)}`],
      [PRODUCTS.mainTee.name,    PRODUCTS.mainTee.dim,    results.totalMainTees,    "pza", `S/${UNIT_PRICES.mainTee}`,    `S/${(results.totalMainTees * UNIT_PRICES.mainTee).toFixed(2)}`],
      [PRODUCTS.longCross.name,  PRODUCTS.longCross.dim,  results.totalLongCross,   "pza", `S/${UNIT_PRICES.longCross}`,  `S/${(results.totalLongCross * UNIT_PRICES.longCross).toFixed(2)}`],
      [PRODUCTS.shortCross.name, PRODUCTS.shortCross.dim, results.totalShortCross,  "pza", `S/${UNIT_PRICES.shortCross}`, `S/${(results.totalShortCross * UNIT_PRICES.shortCross).toFixed(2)}`],
      [PRODUCTS.wallAngle.name,  PRODUCTS.wallAngle.dim,  results.totalWallAngles,  "pza", `S/${UNIT_PRICES.wallAngle}`,  `S/${(results.totalWallAngles * UNIT_PRICES.wallAngle).toFixed(2)}`],
      ["Suspensores",            "Con clip metálico",     results.totalHangers,     "u",   `S/${UNIT_PRICES.hanger}`,    `S/${(results.totalHangers * UNIT_PRICES.hanger).toFixed(2)}`],
      ["Alambre galvanizado",    "Calibre 16",            results.totalWire,        "m",   `S/${UNIT_PRICES.wire}`,      `S/${(results.totalWire * UNIT_PRICES.wire).toFixed(2)}`],
      ["Anclajes/Tarugos",       "Fijación techo",        results.totalAnchors,     "u",   `S/${UNIT_PRICES.anchor}`,    `S/${(results.totalAnchors * UNIT_PRICES.anchor).toFixed(2)}`],
    ],
    foot: [["", "", "", "", "TOTAL ESTIMADO", `S/ ${results.estimatedCost.toFixed(2)}`]],
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [99, 102, 241], fontStyle: "bold" },
    footStyles: { fillColor: [236, 253, 245], textColor: [16, 185, 129], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 255] },
    margin: { left: M, right: M },
  });

  // Disclaimer
  const dY = doc.lastAutoTable.finalY + 6;
  doc.setFillColor(255, 251, 235);
  doc.roundedRect(M, dY, PW - M * 2, 16, 2, 2, "F");
  doc.setFontSize(7.5);
  doc.setTextColor(180, 83, 9);
  doc.setFont("helvetica", "italic");
  doc.text(
    "⚠  Precios referenciales. Se recomienda validar con proveedor local antes de adquirir materiales.",
    M + 4, dY + 6,
  );
  doc.text("Los cálculos son estimaciones basadas en fórmulas estándar de la industria.", M + 4, dY + 11);

  // Footer
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Generado por Dechy Inventario — Calculadora de Cielo Raso Modular", PW / 2, PH - 6, { align: "center" });

  doc.save(`cielo-raso-${inputs.largo}x${inputs.ancho}-${inputs.system}.pdf`);
}

// ─── Main Component ───────────────────────────────────────────────────────────
const DEFAULT_INPUTS = {
  largo: "", ancho: "", tileType: "603x603", system: "T-Grid",
  waste: "10", height: "2.50", centered: true,
};

export default function CieloRasoCalculator({ isModal = false, onClose }) {
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [activeTab, setActiveTab] = useState("calc");
  const [exporting, setExporting] = useState(false);

  const results = useMemo(() => calculate(inputs), [inputs]);
  const colors = SYSTEM_COLORS[inputs.system] || SYSTEM_COLORS["T-Grid"];

  const set = (k, v) => setInputs(p => ({ ...p, [k]: v }));

  const handleExcelExport = async () => {
    setExporting(true);
    try { await exportExcel(inputs, results); }
    catch (e) { console.error(e); }
    finally { setExporting(false); }
  };

  const containerCls = isModal
    ? "fixed inset-0 z-[200] flex items-center justify-center p-1 sm:p-3 bg-slate-900/75 backdrop-blur-sm"
    : "w-full min-h-screen bg-slate-50 dark:bg-slate-950 py-4 px-2 sm:px-4";

  const cardCls = isModal
    ? "relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-7xl max-h-[98vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800"
    : "bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-7xl mx-auto flex flex-col overflow-hidden";

  return (
    <div className={containerCls}>
      <div className={cardCls}>

        {/* ─── Header ──────────────────────────────────────────────────── */}
        <div className={`flex items-center justify-between px-4 sm:px-6 py-3 shrink-0 bg-gradient-to-r ${colors.bg}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-white leading-tight truncate">Calculadora Cielo Raso Modular</h2>
              <p className="text-white/65 text-[10px] font-medium hidden sm:block">
                {inputs.system} · Baldosa {inputs.tileType} mm · Módulo 610mm
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {results && (
              <>
                <button onClick={() => exportPDF(inputs, results)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-[10px] font-black uppercase tracking-wide transition-all border border-white/20">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                  <span className="hidden sm:inline">PDF</span>
                </button>
                <button onClick={handleExcelExport} disabled={exporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/80 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wide transition-all border border-emerald-400/40 disabled:opacity-60">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="hidden sm:inline">{exporting ? "..." : "Excel"}</span>
                </button>
              </>
            )}
            {isModal && onClose && (
              <button onClick={onClose}
                className="size-8 flex items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* ─── Tabs ────────────────────────────────────────────────────── */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 px-2 sm:px-5 overflow-x-auto no-scrollbar">
          {[
            { id: "calc", label: "Calculadora" },
            { id: "plan", label: "Plano 2D" },
            { id: "materials", label: "Materiales" },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-3 sm:px-4 py-3 text-[11px] font-black uppercase tracking-wider border-b-2 whitespace-nowrap transition-all shrink-0 ${
                activeTab === t.id
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ─── Body ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* ══ CALCULADORA ══ */}
          {activeTab === "calc" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-slate-800">
              {/* Left: inputs */}
              <div className="p-4 sm:p-6 space-y-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Dimensiones</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { k: "largo", label: "Largo", unit: "m", ph: "Ej: 4.50" },
                      { k: "ancho", label: "Ancho", unit: "m", ph: "Ej: 3.20" },
                      { k: "height", label: "Altura", unit: "m", ph: "Ej: 2.50" },
                      { k: "waste",  label: "Desperdicio", unit: "%", ph: "Ej: 10" },
                    ].map(({ k, label, unit, ph }) => (
                      <div key={k}>
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 block">{label}</label>
                        <div className="relative">
                          <input type="number" step="0.01" min="0" value={inputs[k]}
                            onChange={e => set(k, e.target.value)} placeholder={ph}
                            className="w-full pr-8 pl-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">{unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tile type */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Tipo de Baldosa</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(TILE_OPTIONS).map(([key, { label }]) => (
                      <button key={key} type="button" onClick={() => set("tileType", key)}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${inputs.tileType === key ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" : "border-slate-200 dark:border-slate-700"}`}>
                        <div className={`text-xs font-black ${inputs.tileType === key ? "text-indigo-600" : "text-slate-700 dark:text-slate-300"}`}>{label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{key === "603x603" ? PRODUCTS.tile.dim : "Doble módulo"}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* System */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Sistema de Instalación</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(SYSTEM_COLORS).map(([sys, c]) => (
                      <button key={sys} type="button" onClick={() => set("system", sys)}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${inputs.system === sys ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" : "border-slate-200 dark:border-slate-700"}`}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <div className={`size-2 rounded-full bg-gradient-to-br ${c.bg}`}></div>
                          <span className={`text-[11px] font-black ${inputs.system === sys ? "text-indigo-600" : "text-slate-700 dark:text-slate-300"}`}>{sys}</span>
                        </div>
                        <div className="text-[9px] text-slate-400">
                          {sys === "T-Grid" && "Retícula metálica estándar"}
                          {sys === "Armstrong" && "Sistema suspendido"}
                          {sys === "PVC" && "Perfiles plásticos"}
                          {sys === "Fibra mineral" && "Alta absorción acústica"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Centered toggle */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div>
                    <p className="text-xs font-black text-slate-700 dark:text-slate-300">Distribución Centrada</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Simetría desde el centro del ambiente</p>
                  </div>
                  <button type="button" onClick={() => set("centered", !inputs.centered)}
                    className={`relative inline-flex h-6 items-center rounded-full transition-colors ${inputs.centered ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600"}`}
                    style={{ width: "44px" }}>
                    <span className={`inline-block size-5 transform rounded-full bg-white shadow-sm transition-transform ${inputs.centered ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </div>

                {/* Product reference */}
                <div className="p-3.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                  <p className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest mb-2">Productos Usados en Cálculo</p>
                  <div className="space-y-1">
                    {Object.values(PRODUCTS).map(p => (
                      <div key={p.name} className="flex justify-between text-[10px]">
                        <span className="font-bold text-slate-600 dark:text-slate-400">{p.name}</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-black">{p.dim}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: results */}
              <div className="p-4 sm:p-6">
                {results ? (
                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resultados</p>

                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { l: "Área Total",      v: `${results.area.toFixed(2)} m²`, s: `${results.colCount}×${results.rowCount} módulos`, c: "indigo" },
                        { l: "Perímetro",       v: `${results.perimeter.toFixed(1)} m`, s: "Linear", c: "sky" },
                        { l: "Baldosas",        v: `${results.totalTiles} u`, s: `+${results.wastePercent}% desp.`, c: "violet" },
                        { l: "Costo Estimado",  v: `S/ ${results.estimatedCost.toFixed(0)}`, s: "Referencial", c: "emerald" },
                      ].map(({ l, v, s, c }) => (
                        <div key={l} className={`p-3.5 rounded-2xl bg-${c}-50 dark:bg-${c}-900/20 border border-${c}-100 dark:border-${c}-900/30`}>
                          <div className={`text-base font-black text-${c}-700 dark:text-${c}-400 leading-tight`}>{v}</div>
                          <div className="text-[10px] font-bold text-slate-500 mt-0.5">{l}</div>
                          <div className="text-[9px] text-slate-400">{s}</div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estructura</p>
                      {[
                        { l: `Te Principal (${PRODUCTS.mainTee.dim})`, v: results.totalMainTees, u: "pzas" },
                        { l: `Te Secundaria (${PRODUCTS.longCross.dim})`, v: results.totalLongCross, u: "pzas" },
                        { l: `Te Terciaria (${PRODUCTS.shortCross.dim})`, v: results.totalShortCross, u: "pzas" },
                        { l: `Ángulo Perimetral (${PRODUCTS.wallAngle.dim})`, v: results.totalWallAngles, u: "pzas" },
                        { l: "Suspensores", v: results.totalHangers, u: "u" },
                        { l: "Alambre galvanizado", v: results.totalWire, u: "m" },
                        { l: "Anclajes", v: results.totalAnchors, u: "u" },
                      ].map(({ l, v, u }) => (
                        <div key={l} className="flex justify-between items-center px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 truncate mr-2">{l}</span>
                          <span className="text-xs font-black text-slate-900 dark:text-white shrink-0">{v} <span className="text-slate-400 font-normal text-[10px]">{u}</span></span>
                        </div>
                      ))}
                    </div>

                    <div className="p-3.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-900/30">
                      <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-2">Baldosas</p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        {[
                          { l: "Exactas", v: results.tilesExact.toFixed(1) },
                          { l: "Con desperd.", v: results.totalTiles },
                          { l: "De corte", v: `~${results.cutTiles}` },
                        ].map(({ l, v }) => (
                          <div key={l}>
                            <div className="text-sm font-black text-amber-700 dark:text-amber-400">{v}</div>
                            <div className="text-[9px] text-slate-500">{l}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full min-h-[280px] text-slate-300 dark:text-slate-600 gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-14 h-14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm font-semibold text-center">Ingresa largo y ancho para calcular</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ PLANO 2D ══ */}
          {activeTab === "plan" && (
            <div className="flex flex-col lg:flex-row">
              <div className="flex-1 bg-slate-50 dark:bg-slate-950 min-h-[360px] sm:min-h-[420px] flex items-center justify-center p-3 relative border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800">
                <FloorPlanSVG inputs={inputs} results={results} colors={colors} />
                {results && (
                  <div className="absolute top-3 left-3 flex flex-col gap-1">
                    <div className="px-2.5 py-1 bg-white/90 dark:bg-slate-900/90 rounded-lg text-[10px] font-black text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shadow-sm">
                      {results.colCount} × {results.rowCount} módulos
                    </div>
                  </div>
                )}
              </div>
              <div className="w-full lg:w-60 p-4 shrink-0 bg-white dark:bg-slate-900 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Leyenda del Plano</p>
                <div className="space-y-2">
                  {[
                    { color: "bg-white border-slate-300", label: "Baldosa completa (603×603mm)" },
                    { color: "bg-orange-50 border-orange-400", label: "Baldosa cortada" },
                    { color: "bg-indigo-500", label: `Te Principal (${PRODUCTS.mainTee.dim})` },
                    { color: "bg-indigo-300", label: `Te Secundaria (${PRODUCTS.longCross.dim})` },
                    { color: "bg-indigo-100", label: `Te Terciaria (${PRODUCTS.shortCross.dim})` },
                    { color: "bg-slate-400", label: `Ángulo Perimetral (${PRODUCTS.wallAngle.dim})`, dashed: true },
                    { color: "bg-red-400", label: "Punto de suspensión", circle: true },
                  ].map(({ color, label, dashed, circle }) => (
                    <div key={label} className="flex items-center gap-2">
                      <div className={`${circle ? "rounded-full size-3" : "rounded size-3"} ${color} border shrink-0 ${dashed ? "border-dashed" : ""}`}></div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">{label}</span>
                    </div>
                  ))}
                </div>
                {results && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                    {[
                      ["Módulo grid", "610mm"],
                      ["Te Principal", `${results.mainTeeLines} líneas`],
                      ["Baldosas cortadas", `~${results.cutTiles} u`],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between text-[10px]">
                        <span className="text-slate-500">{k}</span>
                        <span className="font-black text-indigo-600 dark:text-indigo-400">{v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ MATERIALES ══ */}
          {activeTab === "materials" && (
            <div className="p-4 sm:p-6">
              {results ? (
                <div className="space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Lista Detallada de Materiales</p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => exportPDF(inputs, results)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-indigo-500/20">
                        PDF (con plano)
                      </button>
                      <button onClick={handleExcelExport} disabled={exporting}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-60">
                        {exporting ? "Generando..." : "Excel (con plano)"}
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-left min-w-[600px]">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50">
                          {["Material", "Especificaciones", "Cant.", "Unid.", "P.Unit.(S/)", "Total(S/)"].map(h => (
                            <th key={h} className="px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {[
                          { p: PRODUCTS.tile,       qty: results.totalTiles,      price: UNIT_PRICES.tile,       c: "violet" },
                          { p: PRODUCTS.mainTee,    qty: results.totalMainTees,   price: UNIT_PRICES.mainTee,    c: "indigo" },
                          { p: PRODUCTS.longCross,  qty: results.totalLongCross,  price: UNIT_PRICES.longCross,  c: "sky"    },
                          { p: PRODUCTS.shortCross, qty: results.totalShortCross, price: UNIT_PRICES.shortCross, c: "blue"   },
                          { p: PRODUCTS.wallAngle,  qty: results.totalWallAngles, price: UNIT_PRICES.wallAngle,  c: "slate"  },
                          { p: { name: "Suspensores", dim: "Con clip metálico", unit: "u" }, qty: results.totalHangers,  price: UNIT_PRICES.hanger, c: "amber" },
                          { p: { name: "Alambre galvanizado", dim: "Calibre 16", unit: "m" }, qty: results.totalWire, price: UNIT_PRICES.wire, c: "slate" },
                          { p: { name: "Anclajes/Tarugos", dim: "Fijación techo", unit: "u" }, qty: results.totalAnchors, price: UNIT_PRICES.anchor, c: "rose" },
                        ].map(({ p, qty, price, c }) => (
                          <tr key={p.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="px-3 py-2.5 text-sm font-black text-slate-900 dark:text-white">{p.name}</td>
                            <td className="px-3 py-2.5 text-[11px] text-slate-500 dark:text-slate-400">{p.dim}</td>
                            <td className="px-3 py-2.5">
                              <span className={`text-sm font-black text-${c}-600 dark:text-${c}-400`}>{qty}</span>
                            </td>
                            <td className="px-3 py-2.5 text-[11px] text-slate-400">{p.unit}</td>
                            <td className="px-3 py-2.5 text-[11px] font-bold text-slate-600">S/ {price.toFixed(2)}</td>
                            <td className="px-3 py-2.5 text-sm font-black text-slate-900 dark:text-white">S/ {(qty * price).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-emerald-50 dark:bg-emerald-900/20 border-t-2 border-emerald-200 dark:border-emerald-900/30">
                          <td colSpan={5} className="px-3 py-3.5 text-sm font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">Total Estimado</td>
                          <td className="px-3 py-3.5 text-lg font-black text-emerald-700 dark:text-emerald-400">S/ {results.estimatedCost.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="p-3.5 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-900/30 flex gap-3">
                    <span className="text-xl shrink-0">⚠️</span>
                    <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                      Precios referenciales. Los cálculos son estimaciones — validar cantidades con instalador profesional.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-slate-300 dark:text-slate-600 gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-14 h-14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-sm font-semibold">Completa los datos para ver los materiales</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
