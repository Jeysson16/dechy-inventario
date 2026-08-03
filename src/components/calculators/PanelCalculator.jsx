/**
 * PanelCalculator — Wall Panel & Ceiling Panel Calculator
 * Supports multiple spaces, orientation toggle, 2D sketch, PDF / Excel / QR export
 */
import { useState, useMemo, useRef, useCallback } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

// ─── Colour palette for strips ─────────────────────────────────────────────
const STRIP_COLORS = [
  ["#bfdbfe", "#93c5fd"], // blue
  ["#bbf7d0", "#86efac"], // green
];
const WASTE_COLOR = "#fca5a5";
const CUT_COLOR = "#ef4444";

// ─── Core calculation ───────────────────────────────────────────────────────
function calcSpace(product, space, orientation) {
  const pL = Number(product.length) || 0;
  const pW = Number(product.width) || 0;
  const sW = Number(space.width) || 0;
  const sH = Number(space.height) || 0;
  if (!pL || !pW || !sW || !sH) return null;

  // cutDim  = the dimension cut pieces must fit
  // stackDim = the dimension panels are placed side-by-side
  const cutDim = orientation === "vertical" ? sH : sW;
  const stackDim = orientation === "vertical" ? sW : sH;

  let piecesPerUnit, wastePerUnit, cutsPerUnit, productsPerRun, totalProducts;

  if (pL >= cutDim) {
    // Product is CUT to fit cut dimension
    piecesPerUnit = Math.floor(pL / cutDim);
    wastePerUnit = pL - piecesPerUnit * cutDim;
    cutsPerUnit = piecesPerUnit; // each cross-cut
    productsPerRun = 1;
    const stackCount = Math.ceil(stackDim / pW);
    totalProducts = Math.ceil(stackCount / piecesPerUnit);
  } else {
    // Product too short → chain end-to-end (no cross-cutting needed)
    piecesPerUnit = 1;
    cutsPerUnit = 0;
    productsPerRun = Math.ceil(cutDim / pL);
    wastePerUnit = productsPerRun * pL - cutDim;
    const stackCount = Math.ceil(stackDim / pW);
    totalProducts = stackCount * productsPerRun;
  }

  const stackCount = Math.ceil(stackDim / pW);
  const totalCuts = totalProducts * cutsPerUnit;
  const upb = Number(product.unitsPerBox) || 0;
  const fullBoxes = upb ? Math.floor(totalProducts / upb) : 0;
  const looseUnits = upb ? totalProducts % upb : totalProducts;

  // last piece in stack direction may be trimmed
  const lastStackTrimmed = stackDim % pW > 0;
  const lastRunTrimmed = pL >= cutDim ? false : cutDim % pL > 0;

  return {
    sW, sH, pL, pW, cutDim, stackDim,
    piecesPerUnit,
    wastePerUnit: Math.round(wastePerUnit),
    cutsPerUnit,
    productsPerRun,
    stackCount,
    totalProducts,
    totalCuts,
    fullBoxes,
    looseUnits,
    lastStackTrimmed,
    lastRunTrimmed,
    orientation,
  };
}

// ─── 2D Sketch (SVG) ────────────────────────────────────────────────────────
const SpaceSketch = ({ result, space, orientation, maxW = 400, maxH = 260 }) => {
  if (!result) return null;
  const { sW, sH, pW, pL, cutDim, piecesPerUnit, stackCount, productsPerRun, wastePerUnit } = result;

  // Extensión total de material incluyendo desperdicio
  const totalCutDim = pL >= cutDim ? pL : productsPerRun * pL;

  const drawAreaW = orientation === "vertical" ? sW : totalCutDim;
  const drawAreaH = orientation === "vertical" ? totalCutDim : sH;
  const scale = Math.min(maxW / drawAreaW, maxH / drawAreaH, 1.8);

  const cw = sW * scale;
  const ch = sH * scale;
  const wasteExt = wastePerUnit * scale; // zona de desperdicio fuera del espacio

  const ML = 38, MT = 26, MR = 12, MB = 32;
  const svgW = (orientation === "vertical" ? cw : cw + wasteExt) + ML + MR;
  const svgH = (orientation === "vertical" ? ch + wasteExt : ch) + MT + MB;
  const ox = ML, oy = MT;
  const fs = Math.max(7, Math.min(10, scale * 3.5));
  const CLR = [["#bfdbfe", "#93c5fd"], ["#bbf7d0", "#86efac"]];

  const elems = [];

  if (orientation === "vertical") {
    for (let col = 0; col < stackCount; col++) {
      const x = ox + col * pW * scale;
      const colW = col === stackCount - 1 && sW % pW > 0 ? (sW % pW) * scale : pW * scale;
      const pair = CLR[col % 2];

      if (pL >= cutDim) {
        // Cada producto se corta en piezas que encajan en la altura
        for (let row = 0; row < piecesPerUnit; row++) {
          const y = oy + row * cutDim * scale;
          const h = cutDim * scale;
          elems.push(<rect key={`pc${col}r${row}`} x={x} y={y} width={colW} height={h}
            fill={row % 2 === 0 ? pair[0] : pair[1]} stroke="#64748b" strokeWidth={0.7} />);
          if (colW > 24 && h > 14)
            elems.push(<text key={`tc${col}r${row}`} x={x + colW / 2} y={y + h / 2 + 4}
              textAnchor="middle" fontSize={fs} fill="#1e3a5f" fontWeight="700">
              {Math.round(pW)}×{Math.round(cutDim)}
            </text>);
        }
        // Líneas de corte
        for (let row = 1; row <= piecesPerUnit; row++)
          elems.push(<line key={`cl${col}r${row}`}
            x1={x} y1={oy + row * cutDim * scale} x2={x + colW} y2={oy + row * cutDim * scale}
            stroke="#ef4444" strokeWidth={1.2} strokeDasharray="5,3" />);
      } else {
        // Productos encadenados de punta a punta
        for (let run = 0; run < productsPerRun; run++) {
          const y = oy + run * pL * scale;
          const usedH = run === productsPerRun - 1 && cutDim % pL > 0
            ? (cutDim % pL) * scale : pL * scale;
          const usedCm = run === productsPerRun - 1 && cutDim % pL > 0
            ? Math.round(cutDim % pL) : Math.round(pL);
          elems.push(<rect key={`pc${col}run${run}`} x={x} y={y} width={colW} height={usedH}
            fill={run % 2 === 0 ? pair[0] : pair[1]} stroke="#64748b" strokeWidth={0.7} />);
          if (colW > 24 && usedH > 12)
            elems.push(<text key={`tc${col}run${run}`} x={x + colW / 2} y={y + usedH / 2 + 4}
              textAnchor="middle" fontSize={fs} fill="#1e3a5f" fontWeight="700">
              {Math.round(pW)}×{usedCm}
            </text>);
        }
      }
      // Zona de desperdicio (debajo del límite del espacio)
      if (wasteExt > 1) {
        const wy = oy + ch;
        elems.push(<rect key={`wc${col}`} x={x} y={wy} width={colW} height={wasteExt}
          fill="#fca5a5" stroke="#f87171" strokeWidth={0.8} strokeDasharray="3,2" opacity={0.85} />);
        if (wasteExt > 10 && colW > 20)
          elems.push(<text key={`wt${col}`} x={x + colW / 2} y={wy + wasteExt / 2 + 4}
            textAnchor="middle" fontSize={Math.max(6, fs - 1)} fill="#b91c1c" fontWeight="800">
            {wastePerUnit}cm
          </text>);
      }
      // Etiqueta ancho de columna
      if (col < 9)
        elems.push(<text key={`cw${col}`}
          x={x + colW / 2} y={oy + ch + wasteExt + 14}
          textAnchor="middle" fontSize={Math.max(6, fs - 1)} fill="#475569" fontWeight="600">
          {Math.round(col === stackCount - 1 && sW % pW > 0 ? sW % pW : pW)}
        </text>);
    }
  } else {
    // Horizontal: piezas corren de izquierda a derecha, apiladas verticalmente
    for (let row = 0; row < stackCount; row++) {
      const y = oy + row * pW * scale;
      const rowH = row === stackCount - 1 && sH % pW > 0 ? (sH % pW) * scale : pW * scale;
      const pair = CLR[row % 2];

      if (pL >= cutDim) {
        for (let col = 0; col < piecesPerUnit; col++) {
          const x = ox + col * cutDim * scale;
          const w = cutDim * scale;
          elems.push(<rect key={`pr${row}c${col}`} x={x} y={y} width={w} height={rowH}
            fill={col % 2 === 0 ? pair[0] : pair[1]} stroke="#64748b" strokeWidth={0.7} />);
          if (w > 24 && rowH > 12)
            elems.push(<text key={`tr${row}c${col}`} x={x + w / 2} y={y + rowH / 2 + 4}
              textAnchor="middle" fontSize={fs} fill="#1e3a5f" fontWeight="700">
              {Math.round(cutDim)}×{Math.round(pW)}
            </text>);
        }
        for (let col = 1; col <= piecesPerUnit; col++)
          elems.push(<line key={`cl${row}c${col}`}
            x1={ox + col * cutDim * scale} y1={y} x2={ox + col * cutDim * scale} y2={y + rowH}
            stroke="#ef4444" strokeWidth={1.2} strokeDasharray="5,3" />);
      } else {
        for (let run = 0; run < productsPerRun; run++) {
          const x = ox + run * pL * scale;
          const usedW = run === productsPerRun - 1 && cutDim % pL > 0
            ? (cutDim % pL) * scale : pL * scale;
          const usedCm = run === productsPerRun - 1 && cutDim % pL > 0
            ? Math.round(cutDim % pL) : Math.round(pL);
          elems.push(<rect key={`pr${row}run${run}`} x={x} y={y} width={usedW} height={rowH}
            fill={run % 2 === 0 ? pair[0] : pair[1]} stroke="#64748b" strokeWidth={0.7} />);
          if (usedW > 24 && rowH > 12)
            elems.push(<text key={`tr${row}run${run}`} x={x + usedW / 2} y={y + rowH / 2 + 4}
              textAnchor="middle" fontSize={fs} fill="#1e3a5f" fontWeight="700">
              {usedCm}×{Math.round(pW)}
            </text>);
        }
      }
      // Desperdicio a la derecha del límite del espacio
      if (wasteExt > 1) {
        const wx = ox + cw;
        elems.push(<rect key={`wr${row}`} x={wx} y={y} width={wasteExt} height={rowH}
          fill="#fca5a5" stroke="#f87171" strokeWidth={0.8} strokeDasharray="3,2" opacity={0.85} />);
        if (wasteExt > 10 && rowH > 12)
          elems.push(<text key={`wt${row}`} x={wx + wasteExt / 2} y={y + rowH / 2 + 4}
            textAnchor="middle" fontSize={Math.max(6, fs - 1)} fill="#b91c1c" fontWeight="800">
            {wastePerUnit}cm
          </text>);
      }
      // Etiqueta alto de fila
      if (row < 9)
        elems.push(<text key={`rh${row}`} x={ox - 6} y={y + rowH / 2 + 4}
          textAnchor="end" fontSize={Math.max(6, fs - 1)} fill="#475569" fontWeight="600">
          {Math.round(row === stackCount - 1 && sH % pW > 0 ? sH % pW : pW)}
        </text>);
    }
  }

  const legendY = oy + (orientation === "vertical" ? ch + wasteExt : ch) + 16;

  return (
    <svg width={svgW} height={svgH} className="overflow-visible" style={{ maxWidth: "100%", display: "block" }}>
      {/* Fondo del espacio */}
      <rect x={ox} y={oy} width={cw} height={ch} fill="#f8fafc" />
      {/* Piezas y líneas */}
      {elems}
      {/* Borde del espacio (prominente) */}
      <rect x={ox} y={oy} width={cw} height={ch} fill="none" stroke="#0f172a" strokeWidth={2} />
      {/* Borde zona desperdicio */}
      {wasteExt > 1 && orientation === "vertical" &&
        <rect x={ox} y={oy + ch} width={cw} height={wasteExt}
          fill="none" stroke="#dc2626" strokeWidth={1.5} strokeDasharray="5,3" />}
      {wasteExt > 1 && orientation === "horizontal" &&
        <rect x={ox + cw} y={oy} width={wasteExt} height={ch}
          fill="none" stroke="#dc2626" strokeWidth={1.5} strokeDasharray="5,3" />}
      {/* Línea divisoria espacio / desperdicio */}
      {wasteExt > 1 && orientation === "vertical" &&
        <line x1={ox - 4} y1={oy + ch} x2={ox + cw + 4} y2={oy + ch}
          stroke="#dc2626" strokeWidth={2} strokeDasharray="6,3" />}
      {wasteExt > 1 && orientation === "horizontal" &&
        <line x1={ox + cw} y1={oy - 4} x2={ox + cw} y2={oy + ch + 4}
          stroke="#dc2626" strokeWidth={2} strokeDasharray="6,3" />}
      {/* Etiqueta ancho total (arriba) */}
      <text x={ox + cw / 2} y={oy - 10} textAnchor="middle"
        fontSize={Math.max(9, scale * 5)} fill="#0f172a" fontWeight="800">{sW} cm</text>
      {/* Etiqueta alto total (izquierda) */}
      <text x={ox - 22} y={oy + ch / 2} textAnchor="middle"
        transform={`rotate(-90, ${ox - 22}, ${oy + ch / 2})`}
        fontSize={Math.max(9, scale * 5)} fill="#0f172a" fontWeight="800">{sH} cm</text>
      {/* Etiqueta desperdicio */}
      {wasteExt > 4 && orientation === "vertical" &&
        <text x={ox - 22} y={oy + ch + wasteExt / 2} textAnchor="middle"
          transform={`rotate(-90, ${ox - 22}, ${oy + ch + wasteExt / 2})`}
          fontSize={Math.max(7, scale * 4)} fill="#b91c1c" fontWeight="700">
          {wastePerUnit}cm desperd.
        </text>}
      {wasteExt > 4 && orientation === "horizontal" &&
        <text x={ox + cw + wasteExt / 2} y={oy + ch + 13} textAnchor="middle"
          fontSize={Math.max(7, scale * 4)} fill="#b91c1c" fontWeight="700">
          {wastePerUnit}cm desperd.
        </text>}
      {/* Leyenda */}
      <rect x={ox} y={legendY} width={9} height={7} fill="#bfdbfe" stroke="#64748b" strokeWidth={0.5} />
      <text x={ox + 13} y={legendY + 6} fontSize={8} fill="#475569">Pieza</text>
      {wasteExt > 1 && <>
        <rect x={ox + 55} y={legendY} width={9} height={7} fill="#fca5a5" stroke="#f87171" strokeWidth={0.5} />
        <text x={ox + 68} y={legendY + 6} fontSize={8} fill="#b91c1c">Desperdicio ({wastePerUnit}cm)</text>
      </>}
      <line x1={wasteExt > 1 ? ox + 195 : ox + 55} y1={legendY + 3.5}
        x2={wasteExt > 1 ? ox + 208 : ox + 68} y2={legendY + 3.5}
        stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4,2" />
      <text x={wasteExt > 1 ? ox + 211 : ox + 71} y={legendY + 6} fontSize={8} fill="#475569">Corte</text>
    </svg>
  );
};

// ─── Render sketch to canvas (para exportar en PDF/Excel) ───────────────────
async function sketchToCanvas(result, space, orientation, canvasW = 500, canvasH = 340) {
  if (!result) return null;
  const { sW, sH, pW, pL, cutDim, piecesPerUnit, stackCount, productsPerRun, wastePerUnit } = result;

  const totalCutDim = pL >= cutDim ? pL : productsPerRun * pL;
  const drawAreaW = orientation === "vertical" ? sW : totalCutDim;
  const drawAreaH = orientation === "vertical" ? totalCutDim : sH;

  const ML = 44, MT = 34, MR = 16, MB = 38;
  const scale = Math.min((canvasW - ML - MR) / drawAreaW, (canvasH - MT - MB) / drawAreaH, 1.8);

  const cw = sW * scale;
  const ch = sH * scale;
  const wasteExt = wastePerUnit * scale;
  const totalW = (orientation === "vertical" ? cw : cw + wasteExt) + ML + MR;
  const totalH = (orientation === "vertical" ? ch + wasteExt : ch) + MT + MB;

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(totalW);
  canvas.height = Math.ceil(totalH);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const ox = ML, oy = MT;
  const CLR = [["#bfdbfe", "#93c5fd"], ["#bbf7d0", "#86efac"]];
  const fs = Math.max(8, Math.min(11, scale * 3.5));

  const fillRect = (x, y, w, h, fill, stroke, dash = []) => {
    ctx.setLineDash(dash);
    ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 0.8;
    ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
  };
  const label = (text, x, y) => {
    ctx.fillStyle = "#1e3a5f"; ctx.font = `bold ${fs}px sans-serif`;
    ctx.textAlign = "center"; ctx.fillText(text, x, y);
  };
  const wasteLbl = (text, x, y) => {
    ctx.fillStyle = "#b91c1c"; ctx.font = `bold ${Math.max(6, fs - 1)}px sans-serif`;
    ctx.textAlign = "center"; ctx.fillText(text, x, y);
  };

  if (orientation === "vertical") {
    for (let col = 0; col < stackCount; col++) {
      const x = ox + col * pW * scale;
      const colW = col === stackCount - 1 && sW % pW > 0 ? (sW % pW) * scale : pW * scale;
      const pair = CLR[col % 2];
      if (pL >= cutDim) {
        for (let row = 0; row < piecesPerUnit; row++) {
          const y = oy + row * cutDim * scale; const h = cutDim * scale;
          fillRect(x, y, colW, h, row % 2 === 0 ? pair[0] : pair[1], "#64748b");
          if (colW > 26 && h > 14) label(`${Math.round(pW)}×${Math.round(cutDim)}`, x + colW / 2, y + h / 2 + 4);
        }
        ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 1.2; ctx.setLineDash([4, 2]);
        for (let row = 1; row <= piecesPerUnit; row++) {
          ctx.beginPath(); ctx.moveTo(x, oy + row * cutDim * scale); ctx.lineTo(x + colW, oy + row * cutDim * scale); ctx.stroke();
        }
        ctx.setLineDash([]);
      } else {
        for (let run = 0; run < productsPerRun; run++) {
          const y = oy + run * pL * scale;
          const usedH = run === productsPerRun - 1 && cutDim % pL > 0 ? (cutDim % pL) * scale : pL * scale;
          const usedCm = run === productsPerRun - 1 && cutDim % pL > 0 ? Math.round(cutDim % pL) : Math.round(pL);
          fillRect(x, y, colW, usedH, run % 2 === 0 ? pair[0] : pair[1], "#64748b");
          if (colW > 26 && usedH > 12) label(`${Math.round(pW)}×${usedCm}`, x + colW / 2, y + usedH / 2 + 4);
        }
      }
      if (wasteExt > 1) {
        const wy = oy + ch;
        fillRect(x, wy, colW, wasteExt, "#fca5a5", "#f87171", [3, 2]);
        if (wasteExt > 10 && colW > 20) wasteLbl(`${wastePerUnit}cm`, x + colW / 2, wy + wasteExt / 2 + 4);
      }
    }
  } else {
    for (let row = 0; row < stackCount; row++) {
      const y = oy + row * pW * scale;
      const rowH = row === stackCount - 1 && sH % pW > 0 ? (sH % pW) * scale : pW * scale;
      const pair = CLR[row % 2];
      if (pL >= cutDim) {
        for (let col = 0; col < piecesPerUnit; col++) {
          const x = ox + col * cutDim * scale; const w = cutDim * scale;
          fillRect(x, y, w, rowH, col % 2 === 0 ? pair[0] : pair[1], "#64748b");
          if (w > 26 && rowH > 12) label(`${Math.round(cutDim)}×${Math.round(pW)}`, x + w / 2, y + rowH / 2 + 4);
        }
        ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 1.2; ctx.setLineDash([4, 2]);
        for (let col = 1; col <= piecesPerUnit; col++) {
          ctx.beginPath(); ctx.moveTo(ox + col * cutDim * scale, y); ctx.lineTo(ox + col * cutDim * scale, y + rowH); ctx.stroke();
        }
        ctx.setLineDash([]);
      } else {
        for (let run = 0; run < productsPerRun; run++) {
          const x = ox + run * pL * scale;
          const usedW = run === productsPerRun - 1 && cutDim % pL > 0 ? (cutDim % pL) * scale : pL * scale;
          const usedCm = run === productsPerRun - 1 && cutDim % pL > 0 ? Math.round(cutDim % pL) : Math.round(pL);
          fillRect(x, y, usedW, rowH, run % 2 === 0 ? pair[0] : pair[1], "#64748b");
          if (usedW > 26 && rowH > 12) label(`${usedCm}×${Math.round(pW)}`, x + usedW / 2, y + rowH / 2 + 4);
        }
      }
      if (wasteExt > 1) {
        const wx = ox + cw;
        fillRect(wx, y, wasteExt, rowH, "#fca5a5", "#f87171", [3, 2]);
        if (wasteExt > 10 && rowH > 12) wasteLbl(`${wastePerUnit}cm`, wx + wasteExt / 2, y + rowH / 2 + 4);
      }
    }
  }

  // Bordes principales
  ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 2; ctx.setLineDash([]); ctx.strokeRect(ox, oy, cw, ch);
  if (wasteExt > 1) {
    ctx.strokeStyle = "#dc2626"; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]);
    if (orientation === "vertical") ctx.strokeRect(ox, oy + ch, cw, wasteExt);
    else ctx.strokeRect(ox + cw, oy, wasteExt, ch);
    ctx.setLineDash([]);
    // Línea divisoria
    ctx.strokeStyle = "#dc2626"; ctx.lineWidth = 2; ctx.setLineDash([6, 3]);
    if (orientation === "vertical") { ctx.beginPath(); ctx.moveTo(ox - 4, oy + ch); ctx.lineTo(ox + cw + 4, oy + ch); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(ox + cw, oy - 4); ctx.lineTo(ox + cw, oy + ch + 4); ctx.stroke(); }
    ctx.setLineDash([]);
  }

  // Etiquetas de ejes
  ctx.fillStyle = "#0f172a"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
  ctx.fillText(`${sW} cm`, ox + cw / 2, oy - 10);
  ctx.save(); ctx.translate(ox - 26, oy + ch / 2); ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center"; ctx.fillText(`${sH} cm`, 0, 0); ctx.restore();
  if (wasteExt > 4) {
    ctx.fillStyle = "#b91c1c"; ctx.font = "bold 9px sans-serif";
    if (orientation === "vertical") {
      ctx.save(); ctx.translate(ox - 26, oy + ch + wasteExt / 2); ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "center"; ctx.fillText(`${wastePerUnit}cm desperdicio`, 0, 0); ctx.restore();
    } else {
      ctx.textAlign = "center"; ctx.fillText(`${wastePerUnit}cm desperdicio`, ox + cw + wasteExt / 2, oy + ch + 14);
    }
  }

  // Título
  ctx.fillStyle = "#1e293b"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "left";
  ctx.fillText(`${space.name} — ${sW}×${sH}cm — ${orientation === "vertical" ? "Vertical" : "Horizontal"}`, ox, 20);

  // Leyenda
  const ly = canvas.height - MB + 12;
  fillRect(ox, ly, 9, 7, "#bfdbfe", "#64748b");
  ctx.fillStyle = "#475569"; ctx.font = "8px sans-serif"; ctx.textAlign = "left";
  ctx.fillText("Pieza completa", ox + 13, ly + 6);
  if (wasteExt > 1) {
    fillRect(ox + 105, ly, 9, 7, "#fca5a5", "#f87171", [2, 1]);
    ctx.fillStyle = "#b91c1c"; ctx.fillText("Desperdicio", ox + 118, ly + 6);
  }
  ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 2]);
  ctx.beginPath(); ctx.moveTo(ox + 200, ly + 3.5); ctx.lineTo(ox + 215, ly + 3.5); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#475569"; ctx.fillText("Línea de corte", ox + 218, ly + 6);

  return canvas.toDataURL("image/png");
}

// ─── ID generator ───────────────────────────────────────────────────────────
let _id = 0;
const uid = () => `sp${++_id}`;

// ─── Main Component ─────────────────────────────────────────────────────────
const PanelCalculator = ({ calcType = "wall", isModal = false, onClose }) => {
  const [product, setProduct] = useState({
    name: calcType === "wall" ? "Listón de Pared" : "Panel de Techo",
    length: calcType === "wall" ? 290 : 240,
    width: calcType === "wall" ? 19 : 10,
    unitsPerBox: 10,
  });
  const [orientation, setOrientation] = useState("vertical");
  const [spaces, setSpaces] = useState([
    { id: uid(), name: "Espacio 1", width: 300, height: 240 },
  ]);
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  const updateProduct = (k, v) => setProduct((p) => ({ ...p, [k]: v }));
  const updateSpace = (id, k, v) =>
    setSpaces((prev) => prev.map((s) => (s.id === id ? { ...s, [k]: v } : s)));
  const addSpace = () =>
    setSpaces((prev) => [
      ...prev,
      { id: uid(), name: `Espacio ${prev.length + 1}`, width: 300, height: 240 },
    ]);
  const removeSpace = (id) =>
    setSpaces((prev) => (prev.length > 1 ? prev.filter((s) => s.id !== id) : prev));

  const results = useMemo(
    () => spaces.map((s) => ({ space: s, result: calcSpace(product, s, orientation) })),
    [product, spaces, orientation],
  );

  const totals = useMemo(() => {
    const total = results.reduce(
      (acc, { result: r }) => {
        if (!r) return acc;
        acc.products += r.totalProducts;
        acc.cuts += r.totalCuts;
        acc.boxes += r.fullBoxes;
        acc.loose += r.looseUnits;
        return acc;
      },
      { products: 0, cuts: 0, boxes: 0, loose: 0 },
    );
    // Recalculate boxes/units from grand total
    const upb = Number(product.unitsPerBox) || 0;
    if (upb) {
      total.boxes = Math.floor(total.products / upb);
      total.loose = total.products % upb;
    }
    return total;
  }, [results, product.unitsPerBox]);

  // ─── PDF (con planos 2D) ───────────────────────────────────────────────────
  const handleDownloadPDF = useCallback(async () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const M = 14;
    const PW = doc.internal.pageSize.width;
    const PH = doc.internal.pageSize.height;

    // Encabezado
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, PW, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(
      calcType === "wall" ? "CALCULADORA DE PANEL DE PARED" : "CALCULADORA DE PANEL DE TECHO",
      PW / 2, 12, { align: "center" }
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Generado: ${new Date().toLocaleDateString("es-PE", { dateStyle: "long" })}`, PW / 2, 20, { align: "center" });

    let y = 35;

    // Tabla de producto
    doc.setTextColor(0);
    autoTable(doc, {
      startY: y,
      head: [["PRODUCTO", ""]],
      body: [
        ["Nombre", product.name || "—"],
        ["Largo × Ancho", `${product.length} cm × ${product.width} cm`],
        ["Unidades por caja", `${product.unitsPerBox}`],
        ["Orientación", orientation === "vertical" ? "Vertical" : "Horizontal"],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [99, 102, 241] },
      margin: { left: M, right: M },
    });
    y = doc.lastAutoTable.finalY + 6;

    // Resultados por espacio
    for (const { space, result: r } of results) {
      if (!r) continue;

      autoTable(doc, {
        startY: y,
        head: [[`ESPACIO: ${space.name}  (${space.width} × ${space.height} cm)`, ""]],
        body: [
          ["Piezas por unidad", `${r.piecesPerUnit}`],
          ["Cortes por unidad", `${r.cutsPerUnit}`],
          ["Desperdicio por unidad", r.wastePerUnit > 0 ? `${r.wastePerUnit} cm` : "Sin desperdicio"],
          ["Unidades necesarias", `${r.totalProducts} pzas.`],
          ["Cajas completas", `${r.fullBoxes}`],
          ["Unidades sueltas", `${r.looseUnits}`],
        ],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [15, 23, 42] },
        margin: { left: M, right: M },
      });
      y = doc.lastAutoTable.finalY + 4;

      // Plano 2D del espacio
      try {
        const dataUrl = await sketchToCanvas(r, space, orientation, 500, 320);
        if (dataUrl) {
          const imgW = PW - M * 2;
          const imgH = imgW * 320 / 500;
          if (y + imgH + 10 > PH - 15) { doc.addPage(); y = 15; }
          doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(71, 85, 105);
          doc.text(`Plano 2D — ${space.name}`, M, y + 4);
          y += 7;
          doc.addImage(dataUrl, "PNG", M, y, imgW, imgH);
          y += imgH + 8;
        }
      } catch { /* si canvas falla, continuar */ }

      if (y > PH - 30) { doc.addPage(); y = 15; }
    }

    // Resumen total
    autoTable(doc, {
      startY: y,
      head: [["RESUMEN TOTAL", ""]],
      body: [
        ["Total unidades a comprar", `${totals.products} pzas.`],
        ["Total cortes", `${totals.cuts}`],
        ["Cajas completas", `${totals.boxes}`],
        ["Unidades sueltas", `${totals.loose}`],
      ],
      styles: { fontSize: 10, fontStyle: "bold" },
      headStyles: { fillColor: [234, 88, 12] },
      margin: { left: M, right: M },
    });

    doc.save(`calculadora-${calcType}-${Date.now()}.pdf`);
  }, [product, spaces, orientation, results, totals, calcType]);

  // ─── Excel (con hoja de Planos 2D) ────────────────────────────────────────
  const handleDownloadExcel = useCallback(async () => {
    const wb = new ExcelJS.Workbook();

    // Hoja 1: datos
    const ws = wb.addWorksheet("Cálculo Panel");
    ws.columns = [
      { key: "a", width: 30 }, { key: "b", width: 24 },
      { key: "c", width: 22 }, { key: "d", width: 24 },
    ];
    const hStyle = { font: { bold: true, color: { argb: "FFFFFFFF" } }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } }, alignment: { horizontal: "center" } };
    const boldStyle = { font: { bold: true } };
    const orangeStyle = { font: { bold: true, color: { argb: "FFFFFFFF" } }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFEA580C" } } };

    ws.addRow(["CALCULADORA DE " + (calcType === "wall" ? "PANEL DE PARED" : "PANEL DE TECHO"), "", "", ""]).eachCell(c => Object.assign(c, hStyle));
    ws.addRow([]);
    ws.addRow(["PRODUCTO", "", "", ""]).eachCell(c => Object.assign(c, boldStyle));
    ws.addRow(["Nombre", product.name, "", ""]);
    ws.addRow(["Largo", `${product.length} cm`, "", ""]);
    ws.addRow(["Ancho", `${product.width} cm`, "", ""]);
    ws.addRow(["Unidades por caja", product.unitsPerBox, "", ""]);
    ws.addRow(["Orientación", orientation === "vertical" ? "Vertical" : "Horizontal", "", ""]);
    ws.addRow([]);
    ws.addRow(["Espacio", "Ancho × Alto (cm)", "Unid. necesarias", "Cajas + sueltas"]).eachCell(c => Object.assign(c, hStyle));
    for (const { space, result: r } of results) {
      if (!r) continue;
      ws.addRow([space.name, `${space.width} × ${space.height}`, r.totalProducts, `${r.fullBoxes} caj. + ${r.looseUnits} und.`]);
    }
    ws.addRow([]);
    ws.addRow(["TOTAL", "", totals.products, `${totals.boxes} caj. + ${totals.loose} und.`]).eachCell(c => Object.assign(c, orangeStyle));

    // Hoja 2: planos 2D
    const wsP = wb.addWorksheet("Planos 2D");
    wsP.getColumn(1).width = 75;
    let imgRow = 1;
    for (const { space, result: r } of results) {
      if (!r) continue;
      try {
        const dataUrl = await sketchToCanvas(r, space, orientation, 500, 320);
        if (dataUrl) {
          const base64 = dataUrl.split(",")[1];
          const imageId = wb.addImage({ base64, extension: "png" });
          wsP.getRow(imgRow).height = 16;
          wsP.getCell(`A${imgRow}`).value = `${space.name} — ${space.width}×${space.height}cm`;
          Object.assign(wsP.getCell(`A${imgRow}`), boldStyle);
          imgRow++;
          wsP.addImage(imageId, { tl: { col: 0, row: imgRow - 1 }, ext: { width: 500, height: 320 } });
          imgRow += 23; // saltar filas para la imagen
          wsP.getRow(imgRow).height = 10;
          imgRow++;
        }
      } catch { /* si canvas falla, omitir imagen */ }
    }

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `calculadora-${calcType}-${Date.now()}.xlsx`);
  }, [product, spaces, orientation, results, totals, calcType]);

  // ─── QR ───────────────────────────────────────────────────────────────────
  const handleGenerateQR = useCallback(async () => {
    const lines = [
      `CALCULADORA ${calcType === "wall" ? "PARED" : "TECHO"}`,
      `Producto: ${product.name}`,
      `${product.length}cm × ${product.width}cm | Orientación: ${orientation}`,
      ...results.map(({ space, result: r }) =>
        r ? `${space.name}: ${r.totalProducts} uds. (${r.fullBoxes} caj.+${r.looseUnits})`
          : `${space.name}: sin datos`
      ),
      `TOTAL: ${totals.products} uds. | ${totals.boxes} cajas + ${totals.loose} sueltas`,
      `Cortes totales: ${totals.cuts}`,
    ].join("\n");
    const url = await QRCode.toDataURL(lines, { width: 300, margin: 2 });
    setQrDataUrl(url);
    setShowQR(true);
  }, [product, spaces, orientation, results, totals, calcType]);

  // ─── Render ───────────────────────────────────────────────────────────────
  const titleColor = calcType === "wall" ? "text-indigo-600 dark:text-indigo-400" : "text-teal-600 dark:text-teal-400";
  const accentBg = calcType === "wall" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-teal-600 hover:bg-teal-700";
  const accentBorder = calcType === "wall" ? "border-indigo-200 dark:border-indigo-800" : "border-teal-200 dark:border-teal-800";
  const accentLight = calcType === "wall" ? "bg-indigo-50 dark:bg-indigo-900/20" : "bg-teal-50 dark:bg-teal-900/20";

  return (
    <div className={`w-full ${isModal ? "" : "py-6"}`}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className={`text-xl font-black uppercase tracking-tight ${titleColor}`}>
            {calcType === "wall" ? "Panel de Pared / Listón" : "Panel de Techo"}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Calcula materiales, cortes y bocetos por espacio
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 px-4 h-9 bg-rose-600 text-white rounded-xl text-xs font-black hover:bg-rose-700 transition-all">
            <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>PDF
          </button>
          <button onClick={handleDownloadExcel}
            className="flex items-center gap-1.5 px-4 h-9 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition-all">
            <span className="material-symbols-outlined text-[16px]">table_view</span>Excel
          </button>
          <button onClick={handleGenerateQR}
            className="flex items-center gap-1.5 px-4 h-9 bg-slate-700 text-white rounded-xl text-xs font-black hover:bg-slate-800 transition-all">
            <span className="material-symbols-outlined text-[16px]">qr_code_2</span>QR
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT: Configuration ──────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-5">
          {/* Product */}
          <div className={`rounded-2xl border ${accentBorder} ${accentLight} p-5`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4">
              Producto
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Nombre</label>
                <input value={product.name} onChange={e => updateProduct("name", e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-400/30" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Largo (cm)</label>
                  <input type="number" min="1" value={product.length}
                    onChange={e => updateProduct("length", e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-400/30" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Ancho (cm)</label>
                  <input type="number" min="1" value={product.width}
                    onChange={e => updateProduct("width", e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-400/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Unidades por caja</label>
                <input type="number" min="0" value={product.unitsPerBox}
                  onChange={e => updateProduct("unitsPerBox", e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-400/30" />
              </div>
            </div>

            {/* Product mini-preview */}
            <div className="mt-4 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
              <div style={{ width: 80, height: Math.max(8, 80 * (Number(product.width) / Number(product.length)) || 8) }}
                className="bg-indigo-200 dark:bg-indigo-800 rounded border border-indigo-400/40 flex-shrink-0" />
              <div>
                <p className="text-xs font-black text-slate-800 dark:text-slate-200">{product.length} × {product.width} cm</p>
                <p className="text-[10px] text-slate-400">Vista escala</p>
              </div>
            </div>
          </div>

          {/* Orientation */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">
              Orientación del panel
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "vertical", label: "Vertical", desc: "Panel corre de arriba a abajo", icon: "swap_vert" },
                { key: "horizontal", label: "Horizontal", desc: "Panel corre de lado a lado", icon: "swap_horiz" },
              ].map(({ key, label, desc, icon }) => (
                <button key={key} onClick={() => setOrientation(key)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-center ${
                    orientation === key
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30"
                      : "border-slate-200 dark:border-slate-700 hover:border-indigo-300"
                  }`}>
                  <span className={`material-symbols-outlined text-[28px] ${orientation === key ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`}>
                    {icon}
                  </span>
                  <span className={`text-xs font-black ${orientation === key ? "text-indigo-700 dark:text-indigo-300" : "text-slate-600 dark:text-slate-400"}`}>
                    {label}
                  </span>
                  <span className="text-[9px] text-slate-400 leading-tight">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Totals summary */}
          {totals.products > 0 && (
            <div className={`rounded-2xl border ${accentBorder} p-4`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">
                Resumen Total
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400">Unidades totales</span>
                  <span className="font-black text-indigo-600 dark:text-indigo-400 text-base">{totals.products}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400">Cortes totales</span>
                  <span className="font-black text-rose-600">{totals.cuts}</span>
                </div>
                <div className="border-t border-slate-100 dark:border-slate-800 pt-1.5 flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400">Cajas completas</span>
                  <span className="font-black text-emerald-600">{totals.boxes}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400">Unidades sueltas</span>
                  <span className="font-black text-amber-600">{totals.loose}</span>
                </div>
              </div>
              {Number(product.unitsPerBox) > 0 && totals.loose > 0 && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2 mt-3">
                  ⚠ Comprar {totals.boxes + 1} cajas = {(totals.boxes + 1) * Number(product.unitsPerBox)} und. ({(totals.boxes + 1) * Number(product.unitsPerBox) - totals.products} de sobra)
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT: Espacios + Resultados ─────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">
          {spaces.map((space, idx) => {
            const r = results[idx]?.result;
            return (
              <div key={space.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                {/* Cabecera del espacio */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-2">
                    <span className="size-6 rounded-lg bg-indigo-600 text-white text-[11px] font-black flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <input value={space.name} onChange={e => updateSpace(space.id, "name", e.target.value)}
                      className="text-sm font-black text-slate-800 dark:text-white bg-transparent outline-none border-b border-transparent focus:border-indigo-400 px-1 w-40" />
                  </div>
                  {spaces.length > 1 && (
                    <button onClick={() => removeSpace(space.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-600 transition-colors">
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  )}
                </div>

                <div className="p-5 space-y-4">
                  {/* Dimensiones */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                        {orientation === "vertical" ? "Ancho (cm)" : "Largo (cm)"}
                      </label>
                      <input type="number" min="1" value={space.width}
                        onChange={e => updateSpace(space.id, "width", e.target.value)}
                        className="w-full px-3 py-2.5 text-sm font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                        {orientation === "vertical" ? "Alto (cm)" : "Ancho (cm)"}
                      </label>
                      <input type="number" min="1" value={space.height}
                        onChange={e => updateSpace(space.id, "height", e.target.value)}
                        className="w-full px-3 py-2.5 text-sm font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400" />
                    </div>
                  </div>

                  {r && (
                    <>
                      {/* Resumen compacto */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        {[
                          { label: "Piezas/unid.", value: r.piecesPerUnit, color: "text-indigo-600" },
                          { label: "Cortes/unid.", value: r.cutsPerUnit, color: "text-rose-600" },
                          { label: "Unidades", value: r.totalProducts, color: "text-emerald-600" },
                          { label: `${orientation === "vertical" ? "Columnas" : "Filas"}`, value: r.stackCount, color: "text-amber-600" },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="bg-slate-50 dark:bg-slate-800 rounded-xl py-2 px-2 border border-slate-100 dark:border-slate-700">
                            <p className={`text-lg font-black leading-none ${color}`}>{value}</p>
                            <p className="text-[9px] text-slate-400 mt-0.5 font-semibold">{label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Desperdicio info */}
                      {r.wastePerUnit > 0 && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40 rounded-xl text-xs text-red-700 dark:text-red-300 font-semibold">
                          <span className="material-symbols-outlined text-[15px]">content_cut</span>
                          Desperdicio por unidad: <span className="font-black">{r.wastePerUnit} cm</span>
                          {r.pL < r.cutDim
                            ? ` (recorte del último panel encadenado)`
                            : ` (sobrante tras cortar ${r.piecesPerUnit} pieza${r.piecesPerUnit !== 1 ? "s" : ""})`}
                        </div>
                      )}

                      {/* Compra */}
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/40 rounded-xl text-sm font-bold text-indigo-700 dark:text-indigo-300 flex-wrap">
                        <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
                        Comprar:&nbsp;
                        <span className="font-black text-base">{r.totalProducts}</span>&nbsp;unidades
                        {Number(product.unitsPerBox) > 0 && (
                          <>
                            &nbsp;=&nbsp;
                            {r.fullBoxes > 0 && <><span className="font-black">{r.fullBoxes}</span>&nbsp;caja{r.fullBoxes !== 1 ? "s" : ""}</>}
                            {r.fullBoxes > 0 && r.looseUnits > 0 && " + "}
                            {r.looseUnits > 0 && <><span className="font-black">{r.looseUnits}</span>&nbsp;suelta{r.looseUnits !== 1 ? "s" : ""}</>}
                          </>
                        )}
                      </div>

                      {/* Plano 2D */}
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px]">design_services</span>
                          Plano 2D — {space.name}
                        </p>
                        <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-700 p-3 overflow-x-auto">
                          <SpaceSketch result={r} space={space} orientation={orientation} maxW={420} maxH={280} />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Agregar espacio */}
          <button onClick={addSpace}
            className={`w-full py-3 rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 ${accentLight} text-indigo-600 dark:text-indigo-400 text-sm font-black flex items-center justify-center gap-2 hover:border-indigo-500 transition-all`}>
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
            Agregar otro espacio
          </button>
        </div>
      </div>

      {/* ── Modal QR ─────────────────────────────────────────────────────────── */}
      {showQR && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 flex flex-col items-center gap-4 border border-slate-200 dark:border-slate-700 max-w-sm w-full mx-4">
            <p className="text-sm font-black text-slate-800 dark:text-white text-center uppercase tracking-wide">
              QR — Resumen del Cálculo
            </p>
            {qrDataUrl && <img src={qrDataUrl} alt="QR Code" className="size-56 rounded-xl" />}
            <p className="text-[11px] text-slate-400 text-center">Escanea para ver el resumen de materiales</p>
            <div className="flex gap-3">
              <a href={qrDataUrl} download={`qr-calculo-${Date.now()}.png`}
                className="px-5 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 transition-colors flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">download</span>Descargar
              </a>
              <button onClick={() => setShowQR(false)}
                className="px-5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PanelCalculator;
