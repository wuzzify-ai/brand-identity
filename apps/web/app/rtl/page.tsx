import { getDirectionFromLocale } from '../../src/lib/i18n';

export default function RtlPreviewPage() {
  const dir = getDirectionFromLocale('ar');

  return (
    <main className="workspace" dir={dir} lang="ar">
      <section className="panel panel-pad">
        <h1 className="section-title">معاينة اتجاه الواجهة</h1>
        <p className="section-copy">
          هذه الصفحة تؤكد أن التخطيط يدعم اتجاه النص من اليمين إلى اليسار بدون تغيير
          المكونات الأساسية.
        </p>
      </section>
    </main>
  );
}
