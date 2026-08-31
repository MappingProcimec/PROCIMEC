# -*- coding: utf-8 -*-
"""
VISUALIZADOR Y CONVERTIDOR PROFESIONAL DE PERFILES GPR (.GSF a PDF / JPG / PNG)
Akula9000C / Geoscanners GSF y compatibles (GPRSoft PRO).
"""

import os
import sys
import math
import struct
import argparse
import datetime
import json
import base64
import numpy as np
import scipy.signal as dsp_signal
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec

# ==============================================================================
# CONSTANTES FÍSICAS Y DE HARDWARE POR DEFECTO
# ==============================================================================
C_LUZ_M_NS            = 0.30              # Velocidad de la luz en el vacío (m/ns)
CABECERA_DEFAULT      = 937               # Tamaño de cabecera estándar Akula9000C (bytes)
DIELECTRICO_DEF       = 6.0               # Permitividad dieléctrica relativa estándar (RDP)
VENTANA_TIEMPO_NS_DEF = 90.0              # Ventana de tiempo por defecto (ns)
TRAZAS_POR_METRO_DEF  = 112.0             # Odómetro estándar Geoscanners (112 trazas/m)
DX_DEF                = 1.0 / 112.0       # Paso horizontal = 0.00892857 m/traza


# ==============================================================================
# 1. DECODIFICACIÓN Y AUTODETECCIÓN DE ARCHIVOS GSF
# ==============================================================================
def detectar_geometria_gsf(datos: bytes, cabecera: int = 937, max_bytes_analisis: int = 200000):
    tam_total = len(datos)
    datos_utiles_len = tam_total - cabecera
    if datos_utiles_len <= 0:
        raise ValueError(f"El archivo es demasiado pequeño ({tam_total} bytes) para contener cabecera ({cabecera} bytes).")

    muestra_bytes = datos[cabecera : min(tam_total, cabecera + max_bytes_analisis)]
    n_shorts = len(muestra_bytes) // 2
    raw = np.frombuffer(muestra_bytes[:n_shorts * 2], dtype=np.int16).astype(np.float32)
    raw = raw - raw.mean()

    # Correlación FFT
    corr = dsp_signal.correlate(raw, raw, mode='full', method='fft')
    corr = corr[len(raw) - 1:]
    corr0 = corr[0] if corr[0] != 0 else 1.0

    max_lag = min(2500, len(corr))
    lags = np.arange(100, max_lag)
    scores = corr[lags] / corr0

    candidatos = []
    for m_lag, score in zip(lags, scores):
        b_lag = int(m_lag * 2)
        if datos_utiles_len % b_lag == 0:
            candidatos.append((score, b_lag, m_lag))

    if candidatos:
        candidatos.sort(key=lambda x: x[0], reverse=True)
        mejor_score, mejor_bytes, mejor_muestras = candidatos[0]
        return mejor_bytes, mejor_muestras, mejor_score
    else:
        idx_max = int(np.argmax(scores))
        mejor_muestras = int(lags[idx_max])
        mejor_bytes = int(mejor_muestras * 2)
        mejor_score = float(scores[idx_max])
        return mejor_bytes, mejor_muestras, mejor_score


def leer_gsf(ruta_archivo: str, cabecera: int = 937, tam_bloque_manual: int = None):
    if not os.path.exists(ruta_archivo):
        raise FileNotFoundError(f"No se encontró el archivo: {ruta_archivo}")

    with open(ruta_archivo, 'rb') as f:
        datos = f.read()

    tam_total = len(datos)
    header_bytes = datos[:cabecera]

    # --- EXTRACCIÓN DE CABECERA DE HARDWARE AKULA9000C ---
    ventana_ns_hdr = None
    er_hdr = None
    total_trazas_hdr = None
    muestras_hdr = None
    step_hdr = None

    if len(header_bytes) >= 410:
        try:
            # Offset 66 (int16): Ventana / One-Way time
            v_val = struct.unpack('<h', header_bytes[66:68])[0]
            if 1 <= v_val <= 1000:
                ventana_ns_hdr = float(v_val)

            # Offset 84 (int16): Muestras configuradas
            m_val = struct.unpack('<h', header_bytes[84:86])[0]
            if 100 <= m_val <= 5000:
                muestras_hdr = int(m_val)

            # Offset 86 (float32): Constante dieléctrica grabada (RDP)
            er_val = struct.unpack('<f', header_bytes[86:90])[0]
            if 1.0 <= er_val <= 81.0:
                er_hdr = float(er_val)

            # Offset 344 (int16): Total de trazas grabadas
            t_val = struct.unpack('<h', header_bytes[344:346])[0]
            if 10 <= t_val <= 50000:
                total_trazas_hdr = int(t_val)

            # Offset 406 (float32): Paso horizontal
            s_val = struct.unpack('<f', header_bytes[406:410])[0]
            if 0.001 <= s_val <= 2.0:
                step_hdr = float(s_val)
        except Exception:
            pass

    # --- GEOMETRÍA DE BLOQUE Y TRAZAS ---
    if tam_bloque_manual:
        tam_bloque = tam_bloque_manual
        muestras_por_traza = tam_bloque // 2
        score = 1.0
    elif muestras_hdr and (tam_total - cabecera) % (muestras_hdr * 2) == 0:
        muestras_por_traza = muestras_hdr
        tam_bloque = muestras_por_traza * 2
        score = 1.0
    else:
        tam_bloque, muestras_por_traza, score = detectar_geometria_gsf(datos, cabecera=cabecera)

    cuerpo = datos[cabecera:]
    total_trazas = len(cuerpo) // tam_bloque

    if total_trazas == 0:
        raise ValueError(f"No se encontraron trazas válidas en {ruta_archivo}")

    util = cuerpo[: total_trazas * tam_bloque]
    matriz = np.frombuffer(util, dtype="<i2").reshape((total_trazas, muestras_por_traza)).T.astype(np.float32)

    info = {
        "tam_archivo": tam_total,
        "cabecera": cabecera,
        "tam_bloque": tam_bloque,
        "muestras_por_traza": muestras_por_traza,
        "total_trazas": total_trazas,
        "ventana_ns_hdr": ventana_ns_hdr,
        "muestras_hdr": muestras_hdr,
        "er_hdr": er_hdr,
        "total_trazas_hdr": total_trazas_hdr,
        "step_hdr": step_hdr,
        "confianza_autocorrelacion": score
    }
    return matriz, info


# ==============================================================================
# 2. PIPELINE DE FILTROS Y PROCESAMIENTO DIGITAL DE SEÑALES (DSP)
# ==============================================================================
def time_zero_correction(matriz: np.ndarray, margen_max_pct: float = 0.20) -> np.ndarray:
    muestras = matriz.shape[0]
    zona_sup = max(1, int(muestras * margen_max_pct))
    perfil_promedio = np.mean(np.abs(matriz[:zona_sup, :]), axis=1)
    idx_pico = int(np.argmax(perfil_promedio))

    if idx_pico == 0:
        return matriz.copy()

    alineada = np.roll(matriz, -idx_pico, axis=0)
    alineada[-idx_pico:, :] = 0.0
    return alineada


def dewow_filter(matriz: np.ndarray) -> np.ndarray:
    return matriz - np.mean(matriz, axis=0, keepdims=True)


def background_removal(matriz: np.ndarray) -> np.ndarray:
    traza_media = np.mean(matriz, axis=1, keepdims=True)
    return matriz - traza_media


def sec_gain(matriz: np.ndarray, alpha_min: float = 0.001, alpha_max: float = 0.012) -> np.ndarray:
    muestras = matriz.shape[0]
    tiempo = np.arange(muestras, dtype=np.float64)
    curva_amp = np.mean(np.abs(matriz), axis=1).astype(np.float64) + 1e-6
    coefs = np.polyfit(tiempo, np.log(curva_amp), 1)
    alpha = float(np.clip(-coefs[0], alpha_min, alpha_max))

    curva_ganancia = np.exp(alpha * tiempo).astype(np.float32)
    return matriz * curva_ganancia[:, np.newaxis]


def bandpass_filter(matriz: np.ndarray, fc_low: float = 0.01, fc_high: float = 0.35, orden: int = 4) -> np.ndarray:
    b, a = dsp_signal.butter(orden, [fc_low, fc_high], btype='band')
    return dsp_signal.filtfilt(b, a, matriz.astype(np.float64), axis=0).astype(np.float32)


def procesar_radargrama(matriz_cruda: np.ndarray,
                        aplicar_time_zero: bool = True,
                        aplicar_dewow: bool = True,
                        aplicar_sec: bool = True,
                        aplicar_bandpass: bool = True,
                        aplicar_bg_removal: bool = False) -> np.ndarray:
    m = matriz_cruda.copy()
    if aplicar_dewow:
        m = dewow_filter(m)
    if aplicar_time_zero:
        m = time_zero_correction(m)
    if aplicar_bg_removal:
        m = background_removal(m)
    if aplicar_sec:
        m = sec_gain(m)
    if aplicar_bandpass:
        m = bandpass_filter(m)
    return m


def normalizar_clipping_simetrico(matriz: np.ndarray, percentil: float = 98.5):
    vmax = float(np.percentile(np.abs(matriz), percentil))
    if vmax <= 1e-7:
        vmax = float(np.max(np.abs(matriz))) + 1e-6
    return -vmax, vmax


def configurar_ejes_radargrama(ax, total_muestras: int, total_trazas: int,
                                ventana_tiempo_ns: float, profundidad_max_m: float,
                                dx_m: float):
    distancia_total_m = total_trazas * dx_m

    # 1. Eje Izquierdo: Tiempo (ns)
    ax.set_ylabel("Tiempo de Viaje (ns)", fontsize=9, fontweight='bold', color='#1A252C')
    ax.set_ylim(ventana_tiempo_ns, 0)
    ticks_ns = np.linspace(0, ventana_tiempo_ns, 7)
    ax.set_yticks(ticks_ns)
    ax.set_yticklabels([f"{t:.1f}" for t in ticks_ns], fontsize=8)

    # 2. Eje Derecho: Profundidad (m)
    ax_prof = ax.twinx()
    ax_prof.set_ylim(profundidad_max_m, 0)
    ticks_prof = np.linspace(0, profundidad_max_m, 7)
    ax_prof.set_yticks(ticks_prof)
    ax_prof.set_yticklabels([f"{p:.2f}" for p in ticks_prof], fontsize=8)
    ax_prof.set_ylabel("Profundidad Estimada (m)", fontsize=9, fontweight='bold', color='#780000')

    # 3. Eje Superior: Número de Traza
    ax_top = ax.twiny()
    ax_top.set_xlim(1, total_trazas)
    ticks_trazas = np.linspace(1, total_trazas, 8, dtype=int)
    ax_top.set_xticks(ticks_trazas)
    ax_top.set_xticklabels([str(t) for t in ticks_trazas], fontsize=8)
    ax_top.set_xlabel("Número de Traza", fontsize=9, fontweight='bold', color='#1A252C')

    # 4. Eje Inferior: Distancia (m)
    ax.set_xlabel("Distancia Recorrida (m)", fontsize=9, fontweight='bold', color='#1A252C')
    ticks_dist = np.linspace(0, total_trazas, 8)
    ax.set_xticks(ticks_dist)
    ax.set_xticklabels([f"{t * dx_m:.2f}" for t in ticks_dist], fontsize=8)
    ax.tick_params(axis='both', labelsize=8)
    ax.grid(True, alpha=0.22, linestyle=':', color='#333333')

    return ax_prof, ax_top


def procesar_json_api(ruta_gsf: str,
                      er: float = None,
                      ventana_ns: float = None,
                      profundidad_max_m: float = None,
                      dx_m: float = None,
                      longitud_total_m: float = None,
                      cmap: str = "seismic",
                      modo_vista: str = "crudo",
                      aplicar_filtros: bool = False,
                      bg_removal: bool = False):
    """
    Función especial para API Web: procesa el archivo GSF con la lógica Python exacta
    y retorna JSON con imagen en Base64, metadatos y geometría precisa.
    """
    matriz_cruda, info = leer_gsf(ruta_gsf)
    muestras, trazas = matriz_cruda.shape

    if aplicar_filtros:
        matriz_mostrar = procesar_radargrama(matriz_cruda, aplicar_bg_removal=bg_removal)
    else:
        matriz_mostrar = matriz_cruda

    # Calibración Física
    er_final = float(er) if er and er > 0 else (float(info["er_hdr"]) if info.get("er_hdr") and info["er_hdr"] > 0 else DIELECTRICO_DEF)
    v_onda = C_LUZ_M_NS / math.sqrt(er_final)

    if ventana_ns and ventana_ns > 0:
        tw_final = float(ventana_ns)
    elif info.get("ventana_ns_hdr") and info["ventana_ns_hdr"] > 0:
        tw_hdr = float(info["ventana_ns_hdr"])
        tw_final = tw_hdr * 2.0 if tw_hdr <= 30 and muestras >= 400 else tw_hdr
    else:
        tw_final = VENTANA_TIEMPO_NS_DEF

    profundidad_max = float(profundidad_max_m) if profundidad_max_m and profundidad_max_m > 0 else (v_onda * tw_final) / 2.0

    if longitud_total_m and longitud_total_m > 0:
        distancia_total = float(longitud_total_m)
        dx_final = distancia_total / max(1, trazas)
    elif dx_m and dx_m > 0:
        dx_final = float(dx_m)
        distancia_total = trazas * dx_final
    elif info.get("step_hdr") and info["step_hdr"] > 0:
        dx_final = float(info["step_hdr"])
        distancia_total = trazas * dx_final
    else:
        dx_final = DX_DEF
        distancia_total = trazas * dx_final

    extent = [0, trazas, tw_final, 0]

    # Generar Renderizado
    fig, ax = plt.subplots(figsize=(14, 6.5), dpi=150, facecolor="#FFFFFF")
    subtitulo = "DATOS CRUDOS SIN FILTROS (Dato Binario Original)" if not aplicar_filtros else "SEÑAL PROCESADA (Filtros DSP Aplicados)"
    nombre_archivo = os.path.basename(ruta_gsf)
    
    titulo_ppal = (f"RADARGRAMA GPR - {subtitulo}\n"
                   f"Archivo: {nombre_archivo} | RDP = {er_final:.1f} | v = {v_onda:.3f} m/ns | "
                   f"Ventana = {tw_final:.1f} ns | Profundidad Máx = {profundidad_max:.2f} m | Distancia = {distancia_total:.2f} m")
    ax.set_title(titulo_ppal, fontsize=10.5, fontweight='bold', color='#0E1626', pad=22)

    vmin, vmax = normalizar_clipping_simetrico(matriz_mostrar, percentil=98.5)
    im = ax.imshow(matriz_mostrar, cmap=cmap, aspect='auto', extent=extent,
                   vmin=vmin, vmax=vmax, interpolation='nearest')
    
    cb = plt.colorbar(im, ax=ax, pad=0.07, fraction=0.018)
    cb.set_label("Amplitud ADC (16-bit)", fontsize=8)
    cb.ax.tick_params(labelsize=7)
    
    configurar_ejes_radargrama(ax, muestras, trazas, tw_final, profundidad_max, dx_final)

    import io
    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', facecolor=fig.get_facecolor())
    plt.close(fig)
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')

    res_json = {
        "filename": nombre_archivo,
        "numTraces": trazas,
        "numSamples": muestras,
        "er": er_final,
        "velocity": v_onda,
        "timeWindowNs": tw_final,
        "maxDepthM": profundidad_max,
        "totalDistanceM": distancia_total,
        "dxM": dx_final,
        "tracesPerMeter": 1.0 / dx_final,
        "headerInfo": info,
        "imageBase64": f"data:image/png;base64,{img_base64}"
    }
    return res_json


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--json-api":
        # Formato: python visualizador_gpr_gsf.py --json-api <ruta_gsf> [er] [ventana_ns] [dx] [longitud] [cmap] [con_filtros]
        ruta = sys.argv[2]
        er = float(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3] != "null" else None
        ventana = float(sys.argv[4]) if len(sys.argv) > 4 and sys.argv[4] != "null" else None
        dx = float(sys.argv[5]) if len(sys.argv) > 5 and sys.argv[5] != "null" else None
        longitud = float(sys.argv[6]) if len(sys.argv) > 6 and sys.argv[6] != "null" else None
        cmap = sys.argv[7] if len(sys.argv) > 7 and sys.argv[7] != "null" else "seismic"
        filtros = (sys.argv[8].lower() == "true") if len(sys.argv) > 8 else False

        res = procesar_json_api(ruta, er=er, ventana_ns=ventana, dx_m=dx, longitud_total_m=longitud, cmap=cmap, aplicar_filtros=filtros)
        print("__GPR_JSON_START__")
        print(json.dumps(res))
        print("__GPR_JSON_END__")
    else:
        print("Uso CLI estándar.")
