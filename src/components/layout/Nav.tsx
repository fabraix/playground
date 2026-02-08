import { Menu } from 'lucide-react'

interface NavProps {
    onMobileMenuClick?: () => void
}

/**
 * Navigation component matching www site branding
 */
export function Nav({ onMobileMenuClick }: NavProps) {
    return (
        <nav className="nav">
            <div className="nav-left">
                <a href="https://fabraix.com" className="logo">FABRAIX</a>
            </div>
            <div className="nav-right">
                <a
                    href="https://docs.fabraix.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nav-link"
                >
                    Docs
                </a>
                <a href="https://app.fabraix.com" className="nav-cta">
                    Try the Platform
                </a>
                {onMobileMenuClick && (
                    <button
                        className="mobile-menu-btn"
                        onClick={onMobileMenuClick}
                        aria-label="Open analysis panel"
                    >
                        <Menu size={20} />
                    </button>
                )}
            </div>
        </nav>
    )
}
