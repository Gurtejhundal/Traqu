import { Link } from 'react-router-dom'
import { ArrowDownToLine, ArrowUpRight, Check, Monitor, Terminal, Apple } from 'lucide-react'

const releases = 'https://github.com/Gurtejhundal/Traqu/releases'
const asset = (name) => `${releases}/latest/download/${name}`
const platforms = [
    { name: 'Windows', detail: 'Windows 10 / 11 · 64-bit Intel & AMD', icon: Monitor,
        files: [['Setup .exe', 'Traqo-Windows-x64.exe']],
        steps: 'Open the setup file, choose an install location, and launch Traqo.' },
    { name: 'Linux', detail: '64-bit Intel & AMD · Ubuntu 22.04 or newer baseline', icon: Terminal,
        files: [['AppImage', 'Traqo-Linux-x64.AppImage'], ['Debian / Ubuntu .deb', 'Traqo-Linux-x64.deb']],
        steps: 'For AppImage, allow execution in file properties, then open it. For Debian / Ubuntu, install the .deb with your package manager.' },
    { name: 'macOS', detail: 'macOS 13 or newer · choose your Mac’s chip', icon: Apple,
        files: [['Apple Silicon .dmg', 'Traqo-macOS-arm64.dmg'], ['Intel .dmg', 'Traqo-macOS-x64.dmg']],
        steps: 'Open the disk image and drag Traqo to Applications. Find your chip under Apple menu → About This Mac.' },
]

export default function Downloads() {
    return (
        <main className="guide-page">
            <header className="guide-hero">
                <span className="eyebrow">At home on your computer</span>
                <h1>Your plans.<br /><span>Your desktop.</span></h1>
                <p>A quiet space to turn a plan into progress. Install once, bring your documents, and keep working offline.</p>
                <div className="guide-pills"><span><Check size={14} /> No account</span><span><Check size={14} /> Saved on your computer</span><span><Check size={14} /> Python included</span></div>
            </header>
            <div className="download-grid">
                {platforms.map(({ name, detail, icon: Icon, files, steps }, index) => (
                    <section className="download-card" key={name}>
                        <div className="guide-card-top"><Icon size={26} strokeWidth={1.4} /><span>0{index + 1}</span></div>
                        <h2>{name}</h2><p className="download-spec">{detail}</p>
                        <div className="download-actions">{files.map(([label, filename]) => <a className="btn-primary" href={asset(filename)} key={filename}><ArrowDownToLine size={15} /> {label}</a>)}</div>
                        <p className="download-instructions">{steps}</p>
                    </section>
                ))}
            </div>
            <section className="guide-note">
                <h2>A few details before you install</h2>
                <p>These builds are currently unsigned. Windows may show SmartScreen; macOS may require approval under System Settings → Privacy &amp; Security. Only open a download you trust.</p>
                <p>Linux AppImage may need FUSE 2 from your distribution. Prefer the DEB on Debian / Ubuntu if AppImage does not launch. ARM Linux and ARM Windows builds are not available yet.</p>
                <p>Installers are published after native tests pass on Linux, Windows, and both Mac architectures. Performance depends on your hardware and document size.</p>
                <a className="text-link" href={releases} target="_blank" rel="noreferrer">Release notes, Mac ZIP files &amp; SHA-256 checksums <ArrowUpRight size={14} /></a>
            </section>
            <footer className="guide-footer"><span>Made for the next small step.</span><Link to="/agents">Planning with an AI agent? <ArrowUpRight size={14} /></Link></footer>
        </main>
    )
}
