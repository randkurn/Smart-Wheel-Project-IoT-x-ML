// SW-09 ML evaluasi (tampilan saja). Belum ada model — halaman menampilkan
// kerangka & kontrak ml_eval yang ditunggu dari tim ML.
import Card from '../components/Card';

const METRICS = ['Precision / Recall / F1 per kelas', 'Macro-F1 (target ≥ 0,80)', 'Recall BERLUBANG (target ≥ 0,85)', 'Balanced accuracy', 'Latensi inferensi'];
const MODELS = ['Baseline ambang RMS/peak', 'Decision Tree', 'Random Forest (utama)'];
const CLASSES = ['NORMAL', 'BERGELOMBANG', 'BERLUBANG'];

const CONTRACT = `{
  "model_version": "rf-1.0.0",
  "split": { "train": "S1-S3", "val": "S4", "test": "S5-S6" },
  "classes": ["NORMAL", "BERGELOMBANG", "BERLUBANG"],
  "confusion_matrix": [[0,0,0],[0,0,0],[0,0,0]],
  "per_class": { "NORMAL": { "precision": 0, "recall": 0, "f1": 0 } },
  "macro_f1": 0,
  "balanced_accuracy": 0,
  "inference_latency_ms": 0,
  "comparison": [{ "model": "baseline", "macro_f1": 0 }]
}`;

export default function MlEvalPage() {
  return (
    <div className="content">
      <div className="grid">
        <div className="span-12">
          <Card title="Status" right={<span className="pill warn"><span className="dot" />Menunggu ml_eval dari tim ML</span>}>
            <div className="muted">
              Model ML belum terintegrasi. Halaman ini akan menampilkan hasil evaluasi pada <b>test set terkunci (sesi 5–6)</b> setelah
              tim ML mengirim <span className="mono">ml_eval</span> dan <span className="mono">model_info</span> ke Firebase (T18, T20).
            </div>
          </Card>
        </div>

        <div className="span-5">
          <Card title="Confusion Matrix" subtitle="Aktual (baris) × Prediksi (kolom)">
            <table className="tbl" style={{ textAlign: 'center' }}>
              <thead>
                <tr><th />{CLASSES.map((c) => <th key={c} style={{ textAlign: 'center' }}>{c.slice(0, 5)}</th>)}</tr>
              </thead>
              <tbody>
                {CLASSES.map((r) => (
                  <tr key={r}>
                    <th>{r}</th>
                    {CLASSES.map((c) => <td key={c} className="dim mono" style={{ textAlign: 'center' }}>—</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <div className="span-7">
          <Card title="Metrik & Perbandingan Model">
            <table className="tbl">
              <thead><tr><th>Model</th><th>Macro-F1</th><th>Recall Berlubang</th><th>Balanced Acc.</th></tr></thead>
              <tbody>
                {MODELS.map((m) => (
                  <tr key={m}><td>{m}</td><td className="dim">—</td><td className="dim">—</td><td className="dim">—</td></tr>
                ))}
              </tbody>
            </table>
            <div className="muted" style={{ fontSize: 12 }}>Metrik yang akan ditampilkan: {METRICS.join(' · ')}</div>
          </Card>
        </div>

        <div className="span-12">
          <Card title="Draft kontrak ml_eval" subtitle="Disepakati dengan tim ML di Fase 0 (T01)">
            <pre className="mono" style={{ margin: 0, background: 'var(--bg-2)', padding: 14, borderRadius: 8, fontSize: 12, overflow: 'auto' }}>{CONTRACT}</pre>
          </Card>
        </div>
      </div>
    </div>
  );
}
