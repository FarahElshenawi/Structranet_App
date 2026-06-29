import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore.js';
import { profileApi } from '../../services/endpoints.js';

export default function OnboardingModal() {
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const [host, setHost] = useState('');
  const [port, setPort] = useState('3080');
  const [imageMap, setImageMap] = useState('Cisco 7200=c7200-adventerprisek9-mz.124-24.T5.image\nCisco 3745=c3745-adventerprisek9-mz.124-25d.image');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await profileApi.testConnection({ host, port: parseInt(port, 10) });
      setTestResult(result);
    } catch (err) {
      setTestResult({ reachable: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const map = {};
      imageMap.split('\n').forEach(line => {
        const [tmpl, img] = line.split('=').map(s => s.trim());
        if (tmpl && img) map[tmpl] = img;
      });
      await updateProfile({
        gns3Server: { host, port: parseInt(port, 10) },
        imageMap: map,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    setSaving(true);
    try {
      await updateProfile({ gns3Server: { host: null, port: null }, imageMap: {} });
      await fetchProfile(); // refresh so modal closes
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-lg animate-fade-in-up">
        {/* Glow halo */}
        <div className="absolute -inset-2 bg-gradient-to-br from-brand-500/20 via-accent-500/10 to-transparent rounded-3xl blur-2xl pointer-events-none" />

        <div className="relative card overflow-hidden shadow-soft-lg">
          {/* Header */}
          <div className="px-6 py-5 bg-gradient-to-br from-ink-950 to-ink-900 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-grid-dark opacity-50" />
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-500/20 rounded-full blur-2xl" />
            <div className="relative flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-glow-brand">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight">GNS3 Environment Calibration</h2>
                <p className="text-sm text-ink-400 mt-0.5 leading-relaxed">
                  Tell us about your GNS3 setup so we can generate ready-to-run projects with the right images.
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">
                GNS3 Server Connection
              </label>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <input
                    className="input"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="127.0.0.1"
                  />
                  <p className="text-[11px] text-ink-500 mt-1">Host or IP address</p>
                </div>
                <div>
                  <input
                    className="input"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="3080"
                  />
                  <p className="text-[11px] text-ink-500 mt-1">Port</p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={handleTest}
                  disabled={!host || testing}
                  className="btn-secondary text-xs"
                >
                  {testing ? (
                    <>
                      <span className="inline-block w-3.5 h-3.5 border-2 border-ink-300 border-t-ink-700 rounded-full animate-spin" />
                      Testing…
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                      </svg>
                      Test connection
                    </>
                  )}
                </button>

                {testResult?.reachable && (
                  <span className="badge-success animate-fade-in">
                    <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    Reachable · v{testResult.version}
                  </span>
                )}
                {testResult && !testResult.reachable && (
                  <span className="badge-danger animate-fade-in">
                    <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    Not reachable
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">
                Image Mapping
              </label>
              <textarea
                className="input font-mono text-xs leading-relaxed"
                rows={4}
                value={imageMap}
                onChange={(e) => setImageMap(e.target.value)}
              />
              <p className="text-[11px] text-ink-500 mt-1.5">
                One mapping per line, format: <code className="font-mono text-ink-700 bg-ink-100 px-1 py-0.5 rounded">Template Name=image-file.iso</code>
              </p>
            </div>

            {/* Info note */}
            <div className="rounded-lg border border-brand-200 bg-brand-50/60 px-3.5 py-3 flex items-start gap-2.5 text-xs text-brand-800">
              <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0 mt-0.5 text-brand-600" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>
                Don't have GNS3 installed? Skip this step — we'll use cloud defaults so you can still preview and download configurations.
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 bg-ink-50 border-t border-ink-200">
            <button
              onClick={handleSkip}
              disabled={saving}
              className="text-sm text-ink-600 hover:text-ink-900 font-medium transition-colors disabled:opacity-50"
            >
              Skip for now — Use cloud defaults
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary text-sm"
            >
              {saving ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  Save & Continue
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
