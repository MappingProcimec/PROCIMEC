'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Download,
  Share2,
  Check,
  User,
  Building2,
  FolderGit2,
  Cpu,
  Database,
  Briefcase,
  X,
} from 'lucide-react';
import { DiagramNode, DiagramPayload, ReachMode } from './types';

interface OrgChartCanvasProps {
  payload: DiagramPayload;
  selectedDivision: string;
  searchQuery: string;
  onSelectNode?: (node: DiagramNode | null) => void;
}

export function OrgChartCanvas({
  payload,
  selectedDivision,
  searchQuery,
  onSelectNode,
}: OrgChartCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [reachMode, setReachMode] = useState<ReachMode>(null);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Compute graph bounds to auto-center initially
  useEffect(() => {
    if (payload.nodes.length === 0 || !containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    payload.nodes.forEach((n) => {
      if (n.x < minX) minX = n.x;
      if (n.x + n.width > maxX) maxX = n.x + n.width;
      if (n.y < minY) minY = n.y;
      if (n.y + n.height > maxY) maxY = n.y + n.height;
    });

    const diagramWidth = maxX - minX || 800;
    const diagramHeight = maxY - minY || 600;

    const scaleX = (containerWidth - 100) / diagramWidth;
    const scaleY = (containerHeight - 100) / diagramHeight;
    const optimalZoom = Math.min(1.1, Math.max(0.65, Math.min(scaleX, scaleY)));

    setZoom(optimalZoom);
    setPan({
      x: Math.round((containerWidth - diagramWidth * optimalZoom) / 2 - minX * optimalZoom),
      y: Math.round(40),
    });
  }, [payload.mode, payload.nodes]);

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    const newZoom = e.deltaY < 0 ? Math.min(zoom * zoomFactor, 2.5) : Math.max(zoom / zoomFactor, 0.4);
    setZoom(newZoom);
  };

  // Drag pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only pan when clicking on the background canvas, not on interactive nodes
    if ((e.target as HTMLElement).closest('[data-node-card]')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(z * 1.2, 2.5));
  const handleZoomOut = () => setZoom((z) => Math.max(z / 1.2, 0.4));
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 40, y: 40 });
  };

  // Upstream / Downstream reach computation
  const { reachableNodeIds, reachableEdgeIds } = useMemo(() => {
    if (!selectedNodeId || !reachMode) {
      return { reachableNodeIds: null, reachableEdgeIds: null };
    }

    const visitedNodes = new Set<string>([selectedNodeId]);
    const visitedEdges = new Set<string>();

    if (reachMode === 'upstream') {
      // Find ancestors recursively
      const queue = [selectedNodeId];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        payload.edges.forEach((edge) => {
          if (edge.target === curr) {
            visitedEdges.add(edge.id);
            if (!visitedNodes.has(edge.source)) {
              visitedNodes.add(edge.source);
              queue.push(edge.source);
            }
          }
        });
      }
    } else if (reachMode === 'downstream') {
      // Find descendants recursively
      const queue = [selectedNodeId];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        payload.edges.forEach((edge) => {
          if (edge.source === curr) {
            visitedEdges.add(edge.id);
            if (!visitedNodes.has(edge.target)) {
              visitedNodes.add(edge.target);
              queue.push(edge.target);
            }
          }
        });
      }
    }

    return { reachableNodeIds: visitedNodes, reachableEdgeIds: visitedEdges };
  }, [selectedNodeId, reachMode, payload.edges]);

  // Selected node object
  const selectedNode = useMemo(() => {
    return payload.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [selectedNodeId, payload.nodes]);

  const handleSelectNode = (node: DiagramNode) => {
    if (selectedNodeId === node.id) {
      setSelectedNodeId(null);
      setReachMode(null);
      if (onSelectNode) onSelectNode(null);
    } else {
      setSelectedNodeId(node.id);
      if (onSelectNode) onSelectNode(node);
    }
  };

  // Export handlers
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `procimec-${payload.mode}-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportSVG = () => {
    const svgEl = document.getElementById('org-chart-svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = svgUrl;
    downloadAnchor.download = `procimec-architecture-${Date.now()}.svg`;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCopyShareCard = () => {
    navigator.clipboard.writeText(
      `[PROCIMEC] Mapeo de Arquitectura y Organigrama - Sincronizado ${new Date(payload.lastSyncedAt).toLocaleString()}`
    );
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2500);
  };

  // Node Icon Helper
  const getNodeIcon = (type: DiagramNode['type']) => {
    switch (type) {
      case 'direction':
        return <Building2 className="w-4 h-4 text-[#EAA023]" strokeWidth={1.75} />;
      case 'division':
        return <Layers className="w-4 h-4 text-[#EAA023]" strokeWidth={1.75} />;
      case 'user':
        return <User className="w-4 h-4 text-emerald-400" strokeWidth={1.75} />;
      case 'project':
        return <Briefcase className="w-4 h-4 text-amber-400" strokeWidth={1.75} />;
      case 'database':
        return <Database className="w-4 h-4 text-sky-400" strokeWidth={1.75} />;
      case 'system-service':
        return <Cpu className="w-4 h-4 text-[#EAA023]" strokeWidth={1.75} />;
      default:
        return <FolderGit2 className="w-4 h-4 text-neutral-400" strokeWidth={1.75} />;
    }
  };

  return (
    <div className="relative w-full h-[760px] bg-[#14171C] border border-[#2A303C] rounded-2xl overflow-hidden select-none">
      {/* Canvas Background with Technical Blueprint Grid */}
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing overflow-hidden"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{
          backgroundImage: `
            radial-gradient(circle at 1px 1px, rgba(234, 160, 35, 0.12) 1px, transparent 0),
            linear-gradient(to right, rgba(42, 48, 60, 0.3) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(42, 48, 60, 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px, 96px 96px, 96px 96px',
        }}
      >
        {/* World Space Container */}
        <div
          className="absolute origin-top-left transition-transform duration-75 ease-out"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {/* SVG Connections Layer */}
          <svg
            id="org-chart-svg"
            className="absolute top-0 left-0 pointer-events-none overflow-visible"
            style={{ width: 4000, height: 3000 }}
          >
            <defs>
              <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#EAA023" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#EAA023" stopOpacity="0.3" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#EAA023" floodOpacity="0.6" />
              </filter>
            </defs>

            {payload.edges.map((edge) => {
              const sourceNode = payload.nodes.find((n) => n.id === edge.source);
              const targetNode = payload.nodes.find((n) => n.id === edge.target);
              if (!sourceNode || !targetNode) return null;

              // Source connection point (bottom-center)
              const x1 = sourceNode.x + sourceNode.width / 2;
              const y1 = sourceNode.y + sourceNode.height;

              // Target connection point (top-center)
              const x2 = targetNode.x + targetNode.width / 2;
              const y2 = targetNode.y;

              const dy = y2 - y1;
              const pathD = `M ${x1} ${y1} C ${x1} ${y1 + dy / 2}, ${x2} ${y2 - dy / 2}, ${x2} ${y2}`;

              const isDimmed = reachableEdgeIds ? !reachableEdgeIds.has(edge.id) : false;
              const isHighlighted = reachableEdgeIds ? reachableEdgeIds.has(edge.id) : false;

              return (
                <g key={edge.id} className="transition-opacity duration-200">
                  {/* Base Wire Path */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isHighlighted ? '#EAA023' : '#2A303C'}
                    strokeWidth={isHighlighted ? 2.5 : 1.5}
                    strokeDasharray={edge.style === 'dashed' ? '5,5' : undefined}
                    opacity={isDimmed ? 0.15 : 0.85}
                  />

                  {/* Flow Particle Animation (Archify finite motion) */}
                  {edge.animated && !isDimmed && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#EAA023"
                      strokeWidth={2}
                      strokeDasharray="6, 18"
                      className="animate-pulse"
                      opacity={isHighlighted ? 1 : 0.6}
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {/* HTML Nodes Layer */}
          {payload.nodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isDimmed = reachableNodeIds ? !reachableNodeIds.has(node.id) : false;
            const matchesSearch = searchQuery
              ? node.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                node.subtitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                node.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
              : false;

            // Division filtering
            const matchesDivision =
              !selectedDivision || selectedDivision === 'all' || node.category === selectedDivision;

            return (
              <div
                key={node.id}
                data-node-card
                onClick={() => handleSelectNode(node)}
                className={`absolute rounded-xl p-3.5 cursor-pointer transition-all duration-200 ${
                  isDimmed || !matchesDivision ? 'opacity-25 grayscale' : 'opacity-100'
                } ${
                  isSelected
                    ? 'ring-2 ring-[#EAA023] shadow-lg shadow-[#EAA023]/20 bg-[#1E2229]'
                    : matchesSearch
                    ? 'ring-2 ring-amber-400/80 bg-[#1E2229]'
                    : 'bg-[#171A1F] hover:bg-[#1E2229] border border-[#2A303C] hover:border-[#EAA023]/50'
                }`}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  width: `${node.width}px`,
                  height: `${node.height}px`,
                }}
              >
                {/* Node Header */}
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="flex items-center justify-center w-6 h-6 rounded-md bg-[#2A303C]/70 text-[#EAA023] flex-shrink-0">
                      {getNodeIcon(node.type)}
                    </div>
                    <span className="text-xs font-semibold text-white truncate tracking-tight">
                      {node.title}
                    </span>
                  </div>

                  {node.status && (
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        node.status === 'active'
                          ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                          : node.status === 'busy'
                          ? 'bg-[#EAA023] shadow-[0_0_8px_#EAA023]'
                          : 'bg-neutral-500'
                      }`}
                    />
                  )}
                </div>

                {/* Subtitle / Role */}
                {node.subtitle && (
                  <p className="text-[11px] text-neutral-400 truncate mb-2 leading-tight">
                    {node.subtitle}
                  </p>
                )}

                {/* Badges / Meta row */}
                <div className="flex items-center justify-between mt-auto pt-1 border-t border-[#2A303C]/50 text-[10px] font-mono text-neutral-400">
                  <span className="px-1.5 py-0.2 rounded bg-[#2A303C]/60 text-neutral-300">
                    {node.badge || node.category?.toUpperCase() || 'MOD'}
                  </span>
                  {node.meta && Object.keys(node.meta)[0] && (
                    <span className="text-[#EAA023]/90 truncate max-w-[110px]">
                      {Object.values(node.meta)[0]}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Canvas Top Controls */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-[#171A1F]/90 backdrop-blur-md border border-[#2A303C] p-1.5 rounded-xl shadow-xl">
        <span className="px-2 py-1 text-[11px] font-mono uppercase text-[#EAA023] tracking-wider border-r border-[#2A303C]">
          {payload.mode === 'org' ? 'Organigrama' : 'Pipeline'}
        </span>

        {/* Trace Reach Controls (Archify mode) */}
        {selectedNode && (
          <div className="flex items-center gap-1 pl-1">
            <button
              onClick={() => setReachMode(reachMode === 'upstream' ? null : 'upstream')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors active:scale-[0.98] ${
                reachMode === 'upstream'
                  ? 'bg-[#EAA023] text-black font-semibold'
                  : 'text-neutral-300 hover:text-white bg-[#1E2229] border border-[#2A303C]'
              }`}
              title="Rastrear dependencias superiores"
            >
              <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Upstream</span>
            </button>

            <button
              onClick={() => setReachMode(reachMode === 'downstream' ? null : 'downstream')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors active:scale-[0.98] ${
                reachMode === 'downstream'
                  ? 'bg-[#EAA023] text-black font-semibold'
                  : 'text-neutral-300 hover:text-white bg-[#1E2229] border border-[#2A303C]'
              }`}
              title="Rastrear impacto aguas abajo"
            >
              <ArrowDownRight className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Downstream</span>
            </button>

            {reachMode && (
              <button
                onClick={() => setReachMode(null)}
                className="p-1 text-neutral-400 hover:text-white"
                title="Limpiar alcance"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Floating Bottom-Right Zoom & Export Controls */}
      <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2">
        {/* Zoom Bar */}
        <div className="flex items-center gap-1 bg-[#171A1F]/90 backdrop-blur-md border border-[#2A303C] p-1 rounded-xl shadow-xl">
          <button
            onClick={handleZoomOut}
            className="p-2 text-neutral-300 hover:text-white rounded-lg hover:bg-white/5 active:scale-[0.98] transition-colors"
            title="Alejar"
          >
            <ZoomOut className="w-4 h-4" strokeWidth={1.75} />
          </button>
          <span className="px-2 text-xs font-mono text-neutral-400 min-w-[48px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-2 text-neutral-300 hover:text-white rounded-lg hover:bg-white/5 active:scale-[0.98] transition-colors"
            title="Acercar"
          >
            <ZoomIn className="w-4 h-4" strokeWidth={1.75} />
          </button>
          <div className="w-[1px] h-4 bg-[#2A303C] mx-0.5" />
          <button
            onClick={handleResetView}
            className="p-2 text-neutral-300 hover:text-white rounded-lg hover:bg-white/5 active:scale-[0.98] transition-colors"
            title="Centrar diagrama"
          >
            <Maximize2 className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Export Menu */}
        <div className="flex items-center gap-1 bg-[#171A1F]/90 backdrop-blur-md border border-[#2A303C] p-1 rounded-xl shadow-xl">
          <button
            onClick={handleExportSVG}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white rounded-lg hover:bg-white/5 transition-colors active:scale-[0.98]"
            title="Descargar diagrama vectorial SVG"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>SVG</span>
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-neutral-300 hover:text-white rounded-lg hover:bg-white/5 transition-colors active:scale-[0.98]"
            title="Descargar definición tipada JSON IR"
          >
            JSON
          </button>
          <button
            onClick={handleCopyShareCard}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white rounded-lg hover:bg-white/5 transition-colors active:scale-[0.98]"
            title="Copiar tarjeta canónica"
          >
            {copiedNotification ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.75} />
                <span className="text-emerald-400">Copiado</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>Compartir</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Node Inspector Drawer (Right Side) */}
      {selectedNode && (
        <div className="absolute top-4 right-4 bottom-16 z-20 w-80 bg-[#1E2229]/95 backdrop-blur-md border border-[#2A303C] rounded-2xl p-5 shadow-2xl overflow-y-auto flex flex-col animate-in slide-in-from-right-4 duration-200">
          <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#2A303C]">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#EAA023]/10 text-[#EAA023] border border-[#EAA023]/20">
                {getNodeIcon(selectedNode.type)}
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#EAA023]">
                  {selectedNode.type}
                </span>
                <h4 className="text-sm font-semibold text-white leading-tight">
                  {selectedNode.title}
                </h4>
              </div>
            </div>
            <button
              onClick={() => setSelectedNodeId(null)}
              className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>

          <div className="py-4 space-y-4 text-xs">
            {selectedNode.subtitle && (
              <div>
                <span className="text-neutral-400 block mb-0.5">Descripción / Rol:</span>
                <p className="text-white font-medium">{selectedNode.subtitle}</p>
              </div>
            )}

            {selectedNode.email && (
              <div>
                <span className="text-neutral-400 block mb-0.5">Correo Corporativo:</span>
                <span className="font-mono text-neutral-200">{selectedNode.email}</span>
              </div>
            )}

            {selectedNode.status && (
              <div>
                <span className="text-neutral-400 block mb-1">Estado Operativo:</span>
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      selectedNode.status === 'active'
                        ? 'bg-emerald-400'
                        : selectedNode.status === 'busy'
                        ? 'bg-[#EAA023]'
                        : 'bg-neutral-500'
                    }`}
                  />
                  <span className="text-white capitalize font-mono text-[11px]">
                    {selectedNode.status === 'busy' ? 'Alta Carga / Ocupado' : selectedNode.status}
                  </span>
                </div>
              </div>
            )}

            {selectedNode.meta && (
              <div className="space-y-2 pt-2 border-t border-[#2A303C]">
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                  Métricas Operativas
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(selectedNode.meta).map(([key, val]) => (
                    <div key={key} className="p-2 rounded-lg bg-[#171A1F] border border-[#2A303C]">
                      <span className="text-[10px] text-neutral-400 block truncate">{key}</span>
                      <span className="font-mono text-[#EAA023] text-xs font-semibold">
                        {String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedNode.tags && selectedNode.tags.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-[#2A303C]">
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                  Especialidades & Tags
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedNode.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-[10px] font-mono rounded bg-[#171A1F] text-neutral-300 border border-[#2A303C]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-auto pt-3 border-t border-[#2A303C] space-y-2">
            <span className="text-[10px] font-mono text-neutral-500 block">
              ID Nodo: {selectedNode.id}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
