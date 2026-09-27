import { postDialogClasses, postUi, postDateClasses } from './postStyles'

const focus = 'focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-offset-3 focus-visible:outline-[#60a5fa]'
const button = `inline-flex min-h-[40px] items-center justify-center gap-[8px] rounded-[7px] border border-solid px-[14px] py-0 text-[13px] font-semibold whitespace-nowrap [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-45 ${focus}`
const icon = `inline-flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[6px] border border-solid p-0 text-[13px] [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-45 ${focus}`

export const reviewUi = {
  root: 'box-border px-[32px] py-[28px] text-[13px] text-[#16233a] [&_*]:box-border [&_button]:[font-family:inherit] max-[1200px]:px-[22px] max-[600px]:px-[16px] max-[600px]:py-[22px]',
  filterSection: 'rounded-[12px] border border-solid border-[#dce4ed] bg-white p-[22px] shadow-[0_2px_6px_#16233a03] max-[600px]:p-[16px]',
  filterFields: 'grid grid-cols-[minmax(205px,1.4fr)_repeat(3,minmax(0,1fr))] gap-x-[12px] gap-y-[10px] max-[600px]:grid-cols-2 max-[600px]:gap-[12px]',
  label: 'flex min-w-0 flex-col gap-[5px] text-[13px] font-semibold text-[#43536b]',
  input: postUi.input,
  resetButton: postUi.resetButton,
  exportButton: postUi.primaryButton,
  tableContainer: 'overflow-auto rounded-[11px] border border-solid border-[#aebfd1] bg-white shadow-[0_2px_7px_#16233a0a]',
  table: 'w-full min-w-[800px] table-fixed border-collapse text-left text-[12px]',
  tableHead: 'border-0 border-b border-solid border-[#c2d1e2] bg-[#f8fafc] px-[10px] py-[15px] text-[12px] font-semibold text-[#64748b] [overflow-wrap:anywhere]',
  tableCell: 'border-0 border-b border-solid border-[#d7e1eb] px-[10px] py-[15px] align-middle [overflow-wrap:anywhere]',
  title: postUi.title,
  code: 'text-left text-[11px] font-semibold whitespace-nowrap text-[#1a528e]',
  typeLost: 'mt-[8px] inline-flex max-w-full items-center gap-[5px] rounded-[5px] bg-[#fdecef] px-[7px] py-[5px] text-[12px] font-semibold text-[#c12d4d]',
  typeFound: 'mt-[8px] inline-flex max-w-full items-center gap-[5px] rounded-[5px] bg-[#e6f0fa] px-[7px] py-[5px] text-[12px] font-semibold text-[#1a528e]',
  author: 'block text-[12px] font-semibold [overflow-wrap:anywhere]',
  reputation: 'mt-[7px] flex items-center gap-[5px] text-[11px] font-medium leading-[1.6]',
  reputationNeutral: 'text-[#738298]',
  reputationDanger: 'text-[#bd2a49]',
  reputationSuccess: 'text-[#078361]',
  category: 'mt-[0px] inline-flex max-w-full items-center rounded-[4px] px-[7px] py-[3px] text-[11px] font-semibold [overflow-wrap:anywhere]',
  categoryDefault: 'bg-[#f0f3f7] text-[#697b91]',
  categoryElectronic: 'bg-[#e6f0fa] text-[#1a528e]',
  categoryDocuments: 'bg-[#f0e8fa] text-[#6d43a6]',
  categoryPet: 'bg-[#dff7ed] text-[#087454]',
  categoryKeys: 'bg-[#fff1cf] text-[#995b05]',
  location: 'mt-[7px] flex items-start gap-[4px] text-[11px] leading-[1.6] text-[#738298] [&_svg]:mt-[2px] [&_svg]:shrink-0',
  actions: 'flex flex-wrap gap-[6px]',
  viewAction: `${icon} border-transparent bg-transparent text-[#8494a8] hover:bg-[#e6f0fa] hover:text-[#1a528e] focus-visible:bg-[#e6f0fa] focus-visible:text-[#1a528e]`,
  approveAction: `${icon} border-transparent bg-transparent text-[#8494a8] hover:bg-[#d1fae5] hover:text-[#059669] focus-visible:bg-[#d1fae5] focus-visible:text-[#059669]`,
  rejectAction: `${icon} border-transparent bg-transparent text-[#8494a8] hover:bg-[#fdecef] hover:text-[#d93a5b] focus-visible:bg-[#fdecef] focus-visible:text-[#d93a5b]`,
  button: `${button} border-[#c6d6e7] bg-white text-[#1a528e] hover:bg-[#edf4fb]`,
  successButton: `${button} border-[#078361] bg-[#078361] text-white hover:brightness-92`,
  dangerButton: `${button} border-[#c73352] bg-[#c73352] text-white hover:brightness-92`,
  summary: 'mt-[22px] mb-[12px] flex flex-wrap items-center justify-between gap-[8px] text-[14px] text-[#64748b] [&_strong]:px-[3px] [&_strong]:text-[17px] [&_strong]:text-[#1a528e]',
  notice: 'mb-[14px] rounded-[8px] border border-solid border-[#c6dcf3] bg-[#e6f0fa] px-[16px] py-[12px] text-[12px] leading-[1.7] text-[#1a528e] [overflow-wrap:anywhere]',
  pagination: 'mt-[18px] flex items-center justify-between gap-[16px] text-[13px] text-[#8494a8] [&>div]:flex [&>div]:gap-[6px] max-[600px]:flex-wrap',
  pageButton: postUi.iconButton,
  selectedPage: postUi.selectedButton,
  empty: 'flex flex-col items-center px-[20px] py-[54px] text-center text-[#8494a8] [&_h3]:mt-[18px] [&_h3]:mb-[8px] [&_h3]:text-[16px] [&_h3]:font-semibold [&_h3]:text-[#334155] [&_p]:mb-[20px] [&_p]:text-[12px]',
  detailTitle: 'mt-[21px] mb-[12px] text-[21px] leading-[1.6] font-bold text-[#1a528e] [overflow-wrap:anywhere]',
  detailList: 'my-[1em] [&>div]:grid [&>div]:grid-cols-[110px_1fr] [&>div]:gap-[14px] [&>div]:border-0 [&>div]:border-b [&>div]:border-solid [&>div]:border-[#edf1f5] [&>div]:py-[12px] [&>div]:text-[15px] [&_dt]:text-[#8494a8] [&_dd]:m-0 [&_dd]:font-medium [&_dd]:[overflow-wrap:anywhere] max-[600px]:[&>div]:grid-cols-[90px_minmax(0,1fr)] max-[600px]:[&>div]:gap-[10px]',
  heading: 'mt-[20px] mb-[10px] text-[15px] font-semibold',
  description: 'rounded-[8px] border border-solid border-[#c6dcf3] bg-[#e6f0fa] p-[16px] text-[15px] leading-[1.9] [overflow-wrap:anywhere]',
  images: 'flex flex-wrap gap-[12px] [&_img]:h-[150px] [&_img]:w-[150px] [&_img]:rounded-[8px] [&_img]:object-cover',
  editTitle: 'mb-[18px] text-[15px] leading-[1.7] font-semibold [overflow-wrap:anywhere]',
  form: '[&_label]:mb-[16px] [&_label]:flex [&_label]:flex-col [&_label]:gap-[9px] [&_label]:text-[13px] [&_label]:font-medium [&_select]:w-full [&_select]:rounded-[7px] [&_select]:border [&_select]:border-solid [&_select]:border-[#cbd5e1] [&_select]:bg-white [&_select]:px-[12px] [&_select]:py-[10px] [&_select]:text-[15px] [&_select]:text-[#334155] [&_select]:[font-family:inherit] [&_textarea]:min-h-[110px] [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[7px] [&_textarea]:border [&_textarea]:border-solid [&_textarea]:border-[#cbd5e1] [&_textarea]:bg-white [&_textarea]:px-[12px] [&_textarea]:py-[10px] [&_textarea]:text-[15px] [&_textarea]:leading-[1.7] [&_textarea]:text-[#334155] [&_textarea]:[font-family:inherit] [&_textarea[aria-invalid=true]]:border-[#c73352]',
  error: 'mt-[12px] text-[13px] text-[#bd2a49]',
  hint: 'mt-[12px] mb-0 text-[12px] leading-[1.7] text-[#738298]',
}

export const reviewCategoryColors = {
  'Đồ điện tử': reviewUi.categoryElectronic,
  'Ví / Giấy tờ': reviewUi.categoryDocuments,
  'Thú cưng': reviewUi.categoryPet,
  'Chìa khóa': reviewUi.categoryKeys,
}

export const reviewDialogClasses = {
  ...postDialogClasses,
  button: reviewUi.button,
}

export const reviewDateClasses = {
  ...postDateClasses,
  row: 'mt-[12px] flex flex-nowrap items-end gap-[10px] border-0 border-t border-solid border-[#edf1f5] pt-[12px] max-[600px]:flex-wrap [&_.mod-filter-actions]:ml-auto',
}

export const reviewQueueClasses = {
  toolbar: reviewUi.filterSection,
  filterFields: reviewUi.filterFields,
  date: reviewDateClasses,
  actions: 'ml-auto flex gap-[8px] max-[600px]:basis-full max-[600px]:justify-end',
  resetButton: reviewUi.resetButton,
  exportButton: reviewUi.exportButton,
}
