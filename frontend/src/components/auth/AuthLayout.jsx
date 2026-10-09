import AuthArt from './AuthArt'
import BrandMark from './BrandMark'
import Starfield from './Starfield'

export default function AuthLayout({ children }) {
  return (
    <div className="fixed inset-0 flex flex-col overflow-y-auto overflow-x-hidden bg-au-bg bg-[linear-gradient(160deg,var(--color-au-bg-deep)_0%,var(--color-au-bg)_100%)] text-left font-sans text-au-ink">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <Starfield />
        <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_26%_44%,rgba(78,139,224,.28),rgba(5,11,22,0)_70%)] motion-safe:animate-ll-glow-slow" />
        <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(5,11,22,.35)_0%,rgba(5,11,22,.62)_100%)]" />
        <div className="absolute -left-40 -top-55 size-180 rounded-full border border-white/5 motion-safe:animate-ll-drift" />
        <div className="absolute -bottom-45 left-45 size-120 rounded-full border border-white/4" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,11,22,0)_38%,rgba(5,11,22,.6)_100%)]" />
      </div>

      <header className="relative z-10 mx-auto w-full max-w-260 shrink-0 px-[clamp(20px,4vw,40px)] pt-5 lg:absolute lg:inset-x-0 lg:top-0">
        <BrandMark />
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-260 flex-1 flex-col items-center justify-center gap-2 px-[clamp(16px,4vw,40px)] py-6 lg:flex-row lg:justify-between lg:gap-10 lg:py-5">
        {/* Ẩn hình minh hoạ trên màn hình quá thấp (điện thoại xoay ngang) để form không bị đẩy xuống */}
        <div
          aria-hidden="true"
          className="flex justify-center [@media(max-height:560px)]:hidden lg:flex-[0_1_380px] lg:[@media(max-height:560px)]:flex"
        >
          <div className="-my-12 origin-center scale-60 sm:-my-8 sm:scale-70 lg:my-0 lg:scale-80">
            <AuthArt />
          </div>
        </div>

        <section className="w-full max-w-110 rounded-au-card border border-white/16 bg-white/7.5 px-5 py-5 shadow-au-card backdrop-blur-[20px] sm:px-6 sm:py-6 lg:flex-[0_1_440px]">
          <div className="motion-safe:animate-ll-fade">{children}</div>
        </section>
      </main>
    </div>
  )
}
