import { fields, sectionTitles, SOURCES } from './catalog';
import { answerText, visible, type CaseRecord, type ClinicalSettings, defaultSettings } from './model';
export type ExportSection = {
    title: string;
    rows: [
        string,
        string
    ][];
};
export type ExportModel = {
    title: string;
    code: string;
    anonymous: boolean;
    sections: ExportSection[];
    note: string;
};
export function exportModel(r: CaseRecord, anonymous = true, sections: number[] = [0, 1, 2, 3, 4, 5, 6, 7], summary = ''): ExportModel {
    const all = fields(r.kind);
    const prohibited = all.filter(f => f.private).flatMap(f => { const a = r.answers[f.id]; return a?.state === 'recorded' ? (Array.isArray(a.value) ? a.value : [a.value]) : []; }).flatMap(v => v.split(/[,;\n]/)).map(v => v.trim()).filter(v => v.length >= 2 && !['Unknown', 'None', 'Not recorded', 'Yes', 'No'].includes(v)).sort((a, b) => b.length - a.length);
    const scrub = (s: string) => { if (!anonymous)
        return s; let text = s.replace(/https?:\/\/\S+/gi, '[private link omitted]'); for (const word of prohibited)
        text = text.replace(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '[omitted]'); return text.replace(/\b(?:HN|patient\s*ID|national\s*ID)\s*[:#=]?\s*[A-Za-z0-9-]+/gi, '[identifier omitted]'); };
    const result: ExportSection[] = sections.map(n => ({ title: sectionTitles[n], rows: all.filter(f => f.section === n && visible(f, r.answers) && (!anonymous || !f.private) && r.answers[f.id] && r.answers[f.id].state !== 'not_recorded').map(f => [f.label, scrub(answerText(r.answers[f.id]))] as [
            string,
            string
        ]) })).filter(s => s.rows.length);
    if (r.outcomes && sections.includes(6)) { const o = r.outcomes; result.push({ title: 'Structured outcome & follow-up', rows: [['First RAVC treatment', o.firstTreatment || 'Unknown'], ['Wound present', o.wound], ['Initial wound severity', o.severity], ['Healing', o.healing.status + (o.healing.status === 'healed' ? ' · ' + (o.healing.precision === 'exact' ? o.healing.date : o.healing.precision === 'interval' ? o.healing.from + ' to ' + o.healing.to : 'Date unknown') : '')], ...o.followups.map(f => [f.date, 'Sequelae: ' + (f.assessment === 'assessed' ? f.sequelae.join(', ') : f.assessment) + ' · healing: ' + f.healing + ' · recurrence: ' + f.recurrence] as [string, string])] }); }
    const events = r.events.filter(e => sections.includes(e.type === 'Injection' || e.type === 'History' ? 1 : e.type === 'Investigation' ? 3 : e.type === 'Treatment' ? 5 : 6)).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
    if (events.length)
        result.push({ title: 'History & management timeline', rows: events.map(e => [`${e.datePrecision === 'unknown' ? 'Date unknown' : e.date} · ${e.type}`, scrub(`${e.title}\n${e.details}${e.agent ? '\nAgent: ' + e.agent : ''}${e.route ? '\nRoute / technique: ' + e.route : ''}${e.amount ? '\nAmount: ' + e.amount + ' ' + e.unit : ''}${e.response ? '\nResponse: ' + e.response : ''}`)]) });
    if (summary.trim())
        result.unshift({ title: 'Reviewed case summary', rows: [['Summary', scrub(summary.trim())]] });
    return { title: SOURCES[r.kind].title, code: anonymous ? r.presentationCode : r.id, anonymous, sections: result, note: 'Information only · ' + (r.status === 'approved' ? 'Reviewed by clinical owner' : 'Submitted · clinical owner review pending') + (anonymous ? ' · Review free text before sharing.' : ' · Private patient information. Not for external sharing.') };
}
export async function clinicalPdf(model: ExportModel, settings: ClinicalSettings = defaultSettings) {
    const [{ PDFDocument, rgb }, { default: fontkit }, { sarabunBase64 }] = await Promise.all([import('pdf-lib'), import('@pdf-lib/fontkit'), import('../pdf-font')]);
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const font = await doc.embedFont(Buffer.from(sarabunBase64, 'base64'), { subset: true });
    doc.setTitle(model.anonymous ? 'Anonymous clinical case summary' : 'Private clinical case summary');
    doc.setAuthor('RAMA Dermatology');
    const colour = (hex: string) => rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
    const ink = colour(settings.bodyColor), navy = colour(settings.titleColor), background = colour(settings.background), muted = rgb(.40, .47, .56);
    const W = 595.28, H = 841.89, M = 42;
    let page: any, y = 0;
    const pages: any[] = [];
    function wrap(text: string, width: number, size: number) { const lines: string[] = []; for (const para of String(text).replace(/[\u0000-\u0008\u000b-\u001f]/g, '').split('\n')) {
        let line = '';
        for (const ch of Array.from(para)) {
            if (font.widthOfTextAtSize(line + ch, size) > width && line) {
                const space = line.lastIndexOf(' ');
                if (space > line.length * .3) { lines.push(line.slice(0, space)); line = line.slice(space + 1) + ch; }
                else { lines.push(line); line = ch; }
            }
            else
                line += ch;
        }
        lines.push(line);
    } return lines; }
    function newPage() { page = doc.addPage([W, H]); pages.push(page); page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: background }); page.drawText('RAMA DERMATOLOGY', { x: M, y: H - 39, size: 11, font, color: navy }); page.drawText(model.code, { x: M, y: H - 57, size: 9, font, color: muted }); y = H - 83; }
    function text(value: string, size = 10, color = ink, bottom = 64) { for (const line of wrap(value, W - 2 * M, size)) {
        if (y < bottom)
            newPage();
        page.drawText(line, { x: M, y, size, font, color });
        y -= size * 1.5;
    } }
    newPage();
    text(model.title, 19, navy);
    y -= 8;
    text(model.note, 8, muted);
    y -= 10;
    for (const section of model.sections) {
        if (y < 130)
            newPage();
        text(section.title, 13, navy);
        y -= 5;
        for (const [label, value] of section.rows) {
            if (y < 95)
                newPage();
            text(label, 8.5, muted);
            text(value || 'Not recorded', 10);
            y -= 9;
        }
        y -= 7;
    }
    for (let i = 0; i < pages.length; i++) {
        pages[i].drawLine({ start: { x: M, y: 42 }, end: { x: W - M, y: 42 }, thickness: .5, color: rgb(.85, .89, .93) });
        pages[i].drawText(`${model.anonymous ? 'Anonymous presentation copy' : 'Private clinical record'} · ${i + 1} / ${pages.length}`, { x: M, y: 28, size: 8, font, color: muted });
    }
    return doc.save();
}
export async function clinicalPptx(model: ExportModel, settings: ClinicalSettings = defaultSettings) {
    const { default: PptxGenJS } = await import('pptxgenjs');
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'RAMA Dermatology';
    pptx.subject = 'Information-only clinical case summary';
    pptx.title = model.anonymous ? 'Anonymous case presentation' : 'Private case presentation';
    pptx.company = 'RAMA Dermatology';
    pptx.theme = { headFontFace: settings.font, bodyFontFace: settings.font };
    let slideNumber = 0;
    function slide(title: string) { const s = pptx.addSlide(); s.background = { color: settings.background }; s.addText('RAMA DERMATOLOGY', { x: .55, y: .22, w: 10, h: .25, fontSize: 12, color: settings.titleColor, bold: true }); s.addText(title, { x: .55, y: .72, w: 12.2, h: .65, fontSize: settings.titleSize, color: settings.titleColor, fontFace: settings.font, breakLine: false }); s.addText(model.code, { x: .55, y: 1.42, w: 11, h: .3, fontSize: 11, color: '687B94' }); s.addText(model.anonymous ? 'RAMA Dermatology · information-only case summary' : settings.footer, { x: .55, y: 7.12, w: 10.7, h: .2, fontSize: 9, color: '687B94' }); s.addText(String(++slideNumber), { x: 12, y: 7.1, w: .5, h: .25, fontSize: 10, color: '687B94' }); return s; }
    const first = slide(model.title);
    first.addText(model.anonymous ? 'Anonymous presentation copy' : 'Private clinical information', { x: .7, y: 2.55, w: 11.9, h: .6, fontSize: 26, color: settings.bodyColor });
    first.addText(model.note, { x: .7, y: 3.5, w: 11.8, h: 1.3, fontSize: 18, color: settings.bodyColor });
    for (const section of model.sections) {
        let batch: [
            string,
            string
        ][] = [];
        let size = 0;
        const flush = () => { if (!batch.length)
            return; const s = slide(section.title); s.addTable([['Finding / event', 'Recorded information'], ...batch].map(row => row.map(text => ({ text }))), { x: .55, y: 1.95, w: 12.2, colW: [3.8, 8.4], fontFace: settings.font, fontSize: settings.bodySize, color: settings.bodyColor, border: { type: 'solid', pt: .5, color: 'DDE5EF' }, margin: .1, rowH: .38, autoPage: true, autoPageRepeatHeader: true, autoPageHeaderRows: 1, newSlideStartY: 1, fill: { color: settings.background } }); batch = []; size = 0; };
        for (const [label, value] of section.rows) {
            const chunks = Array.from(value).reduce<string[]>((out, ch, i) => { if (i % 340 === 0)
                out.push(''); out[out.length - 1] += ch; return out; }, []);
            for (let i = 0; i < Math.max(1, chunks.length); i++) {
                const v = chunks[i] || 'Not recorded', cost = Math.ceil(v.length / 70) + Math.ceil(label.length / 35);
                if (size + cost > 12)
                    flush();
                batch.push([label + (i ? ' (continued)' : ''), v]);
                size += cost;
            }
        }
        flush();
    }
    return new Uint8Array(await pptx.write({ outputType: 'arraybuffer' }) as ArrayBuffer);
}
