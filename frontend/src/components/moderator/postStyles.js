const focus = 'focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-offset-3 focus-visible:outline-[#60a5fa]'
const button = `inline-flex min-h-[40px] items-center justify-center gap-[8px] rounded-[7px] border border-solid px-[14px] py-0 text-[13px] font-semibold whitespace-nowrap [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-45 ${focus}`
const icon = `inline-flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[6px] border border-solid p-0 text-[13px] [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-45 ${focus}`

export const postUi = {
  button: `${button} border-[#c6d6e7] bg-white text-[#1a528e] hover:bg-[#edf4fb]`,
  primaryButton: `${button} border-[#1a528e] bg-[#1a528e] text-white hover:bg-[#144073]`,
  dangerButton: `${button} border-[#c73352] bg-[#c73352] text-white hover:brightness-92`,
  resetButton: `inline-flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[7px] border border-solid border-[#c6d6e7] bg-white p-0 text-[#1a528e] cursor-pointer hover:bg-[#edf4fb] ${focus}`,
  iconButton: `${icon} border-[#dce4ed] bg-white text-[#64748b] hover:bg-[#edf4fb] hover:text-[#1a528e]`,
  selectedButton: `${icon} border-[#1a528e] bg-[#1a528e] text-white`,
  viewAction: `${icon} border-transparent bg-transparent text-[#8494a8] hover:bg-[#e6f0fa] hover:text-[#1a528e] focus-visible:bg-[#e6f0fa] focus-visible:text-[#1a528e]`,
  editAction: `${icon} border-transparent bg-transparent text-[#8494a8] hover:bg-[#fef3c7] hover:text-[#d97706] focus-visible:bg-[#fef3c7] focus-visible:text-[#d97706]`,
  hideAction: `${icon} border-transparent bg-transparent text-[#8494a8] hover:bg-[#fdecef] hover:text-[#d93a5b] focus-visible:bg-[#fdecef] focus-visible:text-[#d93a5b]`,
  restoreAction: `${icon} border-transparent bg-transparent text-[#8494a8] hover:bg-[#d1fae5] hover:text-[#059669] focus-visible:bg-[#d1fae5] focus-visible:text-[#059669]`,
  label: 'flex min-w-0 flex-col gap-[5px] text-[13px] font-semibold text-[#43536b]',
  input: `h-[40px] w-full min-w-0 rounded-[7px] border border-solid border-[#cbd5e1] bg-white px-[12px] py-0 text-[14px] font-medium text-[#334155] [font-family:inherit] [color-scheme:light] placeholder:text-[13px] placeholder:text-[#718096] placeholder:opacity-100 disabled:cursor-default disabled:bg-[#f1f5f9] aria-invalid:border-[#d93a5b] max-[600px]:px-[8px] ${focus}`,
  title: `block border-0 bg-transparent p-0 text-left text-[13px] leading-[1.65] font-semibold text-[#16233a] [font-family:inherit] [overflow-wrap:anywhere] cursor-pointer hover:text-[#1a528e] ${focus}`,
  badge: 'inline-flex max-w-full items-center gap-[5px] rounded-[5px] px-[7px] py-[5px] text-[11px] font-semibold',
  tableHead: 'border-0 border-b border-solid border-[#c2d1e2] bg-[#f8fafc] px-[10px] py-[15px] text-[12px] font-semibold text-[#64748b] [overflow-wrap:anywhere]',
  tableCell: 'border-0 border-b border-solid border-[#d5e0ec] px-[10px] py-[15px] align-middle [overflow-wrap:anywhere]',
  location: 'mt-[7px] flex items-start gap-[4px] text-[11px] leading-[1.6] text-[#738298] [&_svg]:mt-[2px] [&_svg]:shrink-0',
  error: 'mt-[12px] text-[13px] text-[#bd2a49]',
  editTitle: 'mb-[18px] text-[15px] leading-[1.7] font-semibold',
  description: 'rounded-[8px] border border-solid border-[#c6dcf3] bg-[#e6f0fa] p-[16px] text-[15px] leading-[1.9]',
  subheading: 'mt-[20px] mb-[10px] text-[15px] font-semibold',
}

export const postStatusColors = {
  pending: 'bg-[#fff4da] text-[#b76a05]',
  searching: 'bg-[#e6f0fa] text-[#1a528e]',
  contacted: 'bg-[#eeebff] text-[#6051cc]',
  completed: 'bg-[#dff7ed] text-[#078361]',
  rejected: 'bg-[#fdecef] text-[#bd2a49]',
}
export const postTypeColors = { lost: 'bg-[#fdecef] text-[#c12d4d]', found: 'bg-[#e6f0fa] text-[#1a528e]' }

export const postDialogClasses = {
  dialog: 'm-auto max-h-[calc(var(--screen-h,100dvh)-40px)] w-[min(760px,calc(var(--screen-w,100vw)-32px))] overflow-y-auto rounded-[14px] border-0 bg-white p-0 text-[#16233a] shadow-[0_24px_100px_#0b193040] backdrop:bg-[#0b193075] backdrop:backdrop-blur-[3px]',
  inner: '',
  header: 'flex items-center justify-between gap-[12px] border-0 border-b border-solid border-[#dce4ed] bg-[#f3f7fc] px-[24px] py-[18px] max-[600px]:px-[18px] max-[600px]:py-[16px]',
  title: 'm-0 text-[18px] leading-[1.2] font-bold text-[#16233a] [font-family:inherit]',
  close: postUi.iconButton,
  body: 'p-[24px] max-[600px]:p-[18px]',
  footer: 'flex flex-wrap justify-end gap-[10px] border-0 border-t border-solid border-[#e2e8f0] px-[24px] py-[16px] max-[600px]:px-[18px]',
  button: postUi.button,
}

export const postDateClasses = {
  container: 'w-full',
  row: 'mt-[12px] flex flex-nowrap items-end gap-[10px] border-0 border-t border-solid border-[#edf1f5] pt-[12px] max-[600px]:flex-wrap',
  label: `${postUi.label} max-w-[170px] flex-[0_1_170px] max-[600px]:max-w-none max-[600px]:flex-[1_1_130px]`,
  input: postUi.input,
  separator: 'self-end leading-[40px] text-[#9cabbc] max-[600px]:hidden',
  error: postUi.error,
}
