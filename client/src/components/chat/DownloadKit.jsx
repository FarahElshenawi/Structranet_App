import { useState } from 'react';
import { Download, Check, FileBox, Archive, FileText } from 'lucide-react';
import { exportApi } from '../../services/endpoints.js';

/**
 * DownloadKit — three download buttons shown after export completes.
 *
 * Matches the user's mockup layout (icon | filename + description | Download
 * button) but rendered in the dark chat-page theme (zinc-950/900 + emerald
 * accent) instead of white.
 *
 * Three artifacts:
 *  1. <name>.gns3project — the importable GNS3 project file
 *  2. configs.zip        — all device startup configs (one .cfg per device)
 *  3. requirements.txt   — image-requirements checklist (what to install
 *                           in GNS3 before importing the project)
 *
 * The buttons persist after download (per Q8) so the user can re-download
 * later in the same session.
 *
 * Props:
 *  - exportKit: the object from chatStore.exportKit, populated by the SSE
 *    'deployment_ready' event. Contains { exportId, files, securityProfile,
 *    validation, deviceConfigs }.
 */
export default function DownloadKit({ exportKit }) {
  const [downloaded, setDownloaded] = useState({});

  if (!exportKit?.exportId) return null;

  const { exportId, files = [], securityProfile, validation, deviceConfigs = [] } = exportKit;

  // Build the three card definitions. The filename for the .gns3project
  // comes from the SSE event's files array (entry with type 'gns3project').
  const gns3File = files.find(f => f.type === 'gns3project');
  const gns3Name = gns3File?.name || 'project.gns3project';

  const cards = [
    {
      type: 'gns3project',
      filename: gns3Name,
      description: 'GNS3 Project File',
      icon: FileBox,
      detail: 'Import this into GNS3 to open the full topology.',
    },
    {
      type: 'configs',
      filename: 'configs.zip',
      description: 'Device Startup Configurations',
      icon: Archive,
      detail: `${deviceConfigs.length} device config${deviceConfigs.length !== 1 ? 's' : ''} — one .cfg per device.`,
    },
    {
      type: 'manifest',
      filename: 'requirements.txt',
      description: 'Appliance Requirements Manifest',
      icon: FileText,
      detail: 'Checklist of images you must install in GNS3 before importing.',
    },
  ];

  const handleDownload = (fileType) => {
    const url = exportApi.downloadUrl(exportId, fileType);

    // Use window.open so the browser handles the download natively and
    // respects the server's Content-Disposition header (which sets the
    // correct filename: <name>.gns3project, configs.zip, requirements.txt).
    // We avoid the <a download> trick because:
    //  (a) an empty a.download makes the browser derive the filename from
    //      the URL path segment (e.g. "gns3project") + appends ".json" if
    //      the response is JSON (the 401 error case) — producing wrong
    //      names like "gns3project.json";
    //  (b) the server already sets the correct filename via Content-Disposition,
    //      which window.open honors.
    window.open(url, '_blank');

    setDownloaded(prev => ({ ...prev, [fileType]: true }));
  };

  const validationPassed = validation?.passed !== false;

  return (
    <div className="flex gap-4 animate-fade-in-up">
      {/* Avatar (matches assistant message layout) */}
      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center shadow-md shadow-emerald-500/30">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6" cy="6" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" />
          <path d="M8 6h8M6 8v8M18 8v8M8 18h8" />
        </svg>
      </div>

      {/* Main card */}
      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold text-white">Deployment kit ready</span>
          {validationPassed ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5">
              <Check size={11} strokeWidth={3} />
              Validated
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5">
              Validation issues
            </span>
          )}
          {securityProfile && securityProfile !== 'none' && (
            <span className="inline-flex items-center text-[11px] text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-full px-2 py-0.5 capitalize">
              {securityProfile} security
            </span>
          )}
        </div>

        {/* Three download cards */}
        <div className="space-y-2">
          {cards.map(card => {
            const Icon = card.icon;
            const isDownloaded = downloaded[card.type];
            return (
              <div
                key={card.type}
                className={`group flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                  isDownloaded
                    ? 'border-emerald-500/30 bg-emerald-500/[0.04]'
                    : 'border-zinc-800 bg-zinc-800/40 hover:border-zinc-700 hover:bg-zinc-800/60'
                }`}
              >
                {/* Icon */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                  isDownloaded
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-zinc-700/50 text-zinc-400 group-hover:text-zinc-200'
                }`}>
                  <Icon size={18} />
                </div>

                {/* Filename + description */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate font-mono">
                    {card.filename}
                  </div>
                  <div className="text-xs text-zinc-400 truncate">
                    {card.description}
                  </div>
                  <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                    {card.detail}
                  </div>
                </div>

                {/* Download button */}
                <button
                  onClick={() => handleDownload(card.type)}
                  className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    isDownloaded
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                      : 'bg-zinc-700 text-zinc-200 border border-zinc-600 hover:bg-zinc-600 hover:text-white'
                  }`}
                >
                  {isDownloaded ? (
                    <>
                      <Check size={14} strokeWidth={2.5} />
                      Download again
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      Download
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Hint */}
        <p className="text-[11px] text-zinc-500 mt-3 leading-relaxed">
          Install the required images from the manifest in your GNS3 server before importing the project file.
        </p>
      </div>
    </div>
  );
}
