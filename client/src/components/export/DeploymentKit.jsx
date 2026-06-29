/**
 * Deployment Kit — light theme card.
 */
import { exportApi } from '../../services/endpoints.js';
import { Package, Code, FileText, Download, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function DeploymentKit({ kit }) {
  const { exportId, files = [], securityProfile, validation, deviceConfigs = [] } = kit;

  const downloadFile = (fileType) => {
    const url = exportApi.downloadUrl(exportId, fileType);
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const icons = {
    gns3project: Package,
    configs: Code,
    manifest: FileText,
  };

  return (
    <div className="rounded-xl border border-emerald-200 bg-white shadow-sm overflow-hidden animate-fade-in-up">
      {/* Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-emerald-50 to-white border-b border-emerald-100">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <span className="absolute inset-0 bg-emerald-500/20 rounded-xl blur-md animate-pulse" />
            <div className="relative inline-flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500 text-white shadow-sm">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              Deployment Ready
              <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 text-[10px] uppercase tracking-wider px-2 py-0.5 font-semibold">Complete</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {deviceConfigs.length} device configurations generated with{' '}
              <span className="font-semibold text-emerald-600 capitalize">{securityProfile}</span> security profile.
            </p>
          </div>
        </div>
      </div>

      {/* Files */}
      <div className="p-5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Files</div>
        <ul className="space-y-2">
          {files.map((file, i) => {
            const Icon = icons[file.type] || FileText;
            return (
              <li key={i} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 hover:border-emerald-300 transition-all">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100 flex items-center justify-center">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{file.name}</div>
                  </div>
                </div>
                <button
                  onClick={() => downloadFile(file.type === 'gns3project' ? 'gns3project' : file.type)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-all"
                >
                  <Download size={14} />
                  Download
                </button>
              </li>
            );
          })}
        </ul>

        <button
          onClick={() => downloadFile('all')}
          className="w-full mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 transition-all shadow-sm shadow-emerald-600/20"
        >
          <Download size={16} />
          Download All as ZIP
        </button>

        {/* Validation */}
        {validation && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            {validation.valid ? (
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle2 size={16} />
                Passed all {validation.stats?.total_checks || 0} structural checks
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <AlertTriangle size={16} />
                {validation.issues?.length || 0} issues found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
