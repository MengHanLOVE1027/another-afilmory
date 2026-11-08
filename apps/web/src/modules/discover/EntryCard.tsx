import { Link } from 'react-router'

export interface EntryCardProps {
  to: string
  title: string
  count: number
  description?: string
  images?: string[]
  accent?: string
  index?: number
}

const GRADIENTS = [
  'linear-gradient(135deg, rgba(255,107,107,.9), rgba(255,159,64,.85) 25%, rgba(255,234,167,.8) 45%, rgba(72,219,251,.8) 65%, rgba(118,75,162,.9))',
  'linear-gradient(135deg, rgba(72,219,251,.85), rgba(118,75,162,.85) 45%, rgba(255,107,107,.85))',
  'linear-gradient(135deg, rgba(255,159,64,.85), rgba(255,234,167,.75) 40%, rgba(72,219,251,.8))',
]

const FolderLayer = ({ image, layer }: { image?: string, layer: 2 | 3 }) => {
  const layerClass = layer === 3
    ? 'absolute inset-0 -top-2 -left-2 -rotate-3 rounded-[20px] group-hover:-top-5 group-hover:-left-5 group-hover:-rotate-6'
    : 'absolute inset-0 -top-1 -left-1 -rotate-[1.5deg] rounded-[20px] group-hover:-top-2.5 group-hover:-left-2.5 group-hover:-rotate-3'

  return (
    <div
      className={`${layerClass} overflow-hidden border border-white/10 shadow-[0_16px_36px_-20px_rgba(0,0,0,0.9)] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]`}
      style={{ background: image ? '#121216' : GRADIENTS[layer === 3 ? 0 : 1] }}
    >
      {image
        ? (
            <img
              src={image}
              alt=""
              loading="lazy"
              className="size-full object-cover opacity-55 transition-opacity duration-500 group-hover:opacity-85"
            />
          )
        : (
            <div className="size-full opacity-70" style={{ background: GRADIENTS[layer === 3 ? 2 : 0] }} />
          )}
      <div className="pointer-events-none absolute inset-0 bg-black/25" />
    </div>
  )
}

export const EntryCard = ({
  to,
  title,
  count,
  description,
  images = [],
  accent = 'var(--color-accent)',
  index = 0,
}: EntryCardProps) => {
  const cover = images[0]

  return (
    <Link
      to={to}
      className="group card-enter block"
      style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
    >
      <div className="relative mb-6 aspect-[4/3] transition-transform duration-500 ease-out">
        <FolderLayer image={images[2]} layer={3} />
        <FolderLayer image={images[1]} layer={2} />
        <div
          className="relative size-full overflow-hidden rounded-[20px] border border-white/12 shadow-[0_30px_60px_-28px_rgba(0,0,0,0.95)] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:-translate-y-1 group-hover:scale-[1.015]"
          style={{ background: cover ? '#121216' : `linear-gradient(145deg, ${accent}66, #17171b 68%)` }}
        >
          {cover
            ? (
                <img
                  src={cover}
                  alt={title}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
              )
            : (
                <div className="flex size-full flex-col items-center justify-center gap-2 text-white/60">
                  <i className="i-mingcute-image-off-line text-3xl" />
                  <span className="text-sm">暂无照片</span>
                </div>
              )}
          <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/35 via-transparent to-white/5" />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-70"
            style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
          />
        </div>
      </div>

      <h2 className="text-lg font-semibold tracking-tight text-[var(--site-fg)] transition-colors group-hover:opacity-80">
        {title}
      </h2>
      <p className="mt-1 text-sm text-[var(--site-muted)]">
        {count}
        {' '}
        张照片
      </p>
      {description && (
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--site-muted)]">{description}</p>
      )}
    </Link>
  )
}
