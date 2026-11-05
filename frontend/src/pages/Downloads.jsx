import { Link } from 'react-router-dom'
import { ArrowDownToLine, ArrowUpRight, Check } from 'lucide-react'

const releases = 'https://github.com/Gurtejhundal/Traqu/releases'
const asset = (name) => `${releases}/latest/download/${name}`
const platforms = [
    { name: 'Android preview', detail: 'Android 7+ · current Android System WebView', logo: '/os/android.svg',
        files: [['Preview .apk', 'Traqu-Android-preview.apk']],
        steps: 'An offline preview with a separate on-device workspace. Back up before replacing a preview or uninstalling. JSON is best for complex plans; see the Android guide below.' },
    { name: 'Windows', detail: 'Windows 10 / 11 x64 · Windows 11 ARM64', logo: '/os/windows.svg',
        files: [['Intel / AMD .exe', 'Traqu-Windows-x64.exe'], ['ARM64 .exe', 'Traqu-Windows-arm64.exe']],
        steps: 'Open the setup file, choose an install location, and launch Traqu.' },
    { name: 'Linux', detail: '64-bit Intel & AMD · Ubuntu 22.04 or newer baseline', logo: '/os/linux.svg',
        files: [['AppImage', 'Traqu-Linux-x64.AppImage'], ['Debian / Ubuntu .deb', 'Traqu-Linux-x64.deb']],
        steps: 'For AppImage, allow execution in file properties, then open it. For Debian / Ubuntu, install the .deb with your package manager.' },
    { name: 'macOS', detail: 'macOS 13 or newer · choose your Mac’s chip', logo: '/os/apple.svg',
        files: [['Apple Silicon .dmg', 'Traqu-macOS-arm64.dmg'], ['Intel .dmg', 'Traqu-macOS-x64.dmg']],
        steps: 'Open the disk image and drag Traqu to Applications. Find your chip under Apple menu → About This Mac.' },
]

export default function Downloads() {
    return (
        <main className="guide-page">
            <header className="guide-hero">
                <span className="eyebrow">At home on your devices</span>
                <h1>Your plans.<br /><span>Your space.</span></h1>
                <p>A quiet space to turn a plan into progress. Install once, bring your documents, and keep working offline.</p>
                <div className="guide-pills"><span><Check size={14} /> No account</span><span><Check size={14} /> Saved on your computer</span><span><Check size={14} /> Works offline</span></div>
            </header>
            <div className="download-grid">
                {platforms.map(({ name, detail, logo, files, steps }, index) => (
                    <section className="download-card" key={name}>
                        <div className="guide-card-top"><img src={logo} alt="" className="os-logo" width="32" height="32" /><span>0{index + 1}</span></div>
                        <h2>{name}</h2><p className="download-spec">{detail}</p>
                        <div className="download-actions">{files.map(([label, filename]) => <a className="btn-primary" href={asset(filename)} key={filename}><ArrowDownToLine size={15} /> {label}</a>)}</div>
                        <p className="download-instructions">{steps}</p>
                    </section>
                ))}
            </div>
            <section className="guide-note">
                <h2>A few details before you install</h2>
                <p>These builds are currently unsigned. Windows may show SmartScreen; macOS may require approval under System Settings → Privacy &amp; Security. Only open a download you trust.</p>
                <p>Linux AppImage may need FUSE 2 from your distribution. Prefer the DEB on Debian / Ubuntu if AppImage does not launch. Windows ARM64 has a native build. ARM Linux is not available yet.</p>
                <p>The Android APK is a debug-signed preview. Its signing identity may change between previews. Export a workspace backup before replacing it; Android and desktop do not automatically sync.</p>
                <a className="text-link" href="https://github.com/Gurtejhundal/Traqu/blob/main/docs/ANDROID.md" target="_blank" rel="noreferrer">Android preview scope and upgrade notes <ArrowUpRight size={14} /></a>
                <p>Installers are published after native tests pass on Linux, Windows, and both Mac architectures. Performance depends on your hardware and document size.</p>
                <a className="text-link" href={releases} target="_blank" rel="noreferrer">Release notes, Mac ZIP files &amp; SHA-256 checksums <ArrowUpRight size={14} /></a>
            </section>
            <footer className="guide-footer"><span>Made for the next small step.</span><Link to="/agents">Planning with an AI agent? <ArrowUpRight size={14} /></Link></footer>
        </main>
    )
}
