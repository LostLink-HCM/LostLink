import { postUi } from './postStyles'
import { reviewDialogClasses, reviewUi } from './reviewStyles'

const icon = 'inline-flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[6px] border border-transparent bg-transparent p-0 text-[#8494a8] cursor-pointer hover:bg-[#edf4fb] hover:text-[#1a528e] focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-offset-3 focus-visible:outline-[#60a5fa]'
const button = 'inline-flex min-h-[40px] items-center justify-center gap-[8px] rounded-[7px] border border-solid px-[14px] py-0 text-[13px] font-semibold whitespace-nowrap [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-offset-3 focus-visible:outline-[#60a5fa]'

export const reportUi = {
  ...reviewUi,
  table: 'w-full min-w-[900px] table-fixed border-collapse text-left text-[12px]',
  reason: 'mb-[8px] text-[12px] font-medium leading-[1.6]',
  severity: 'inline-flex max-w-full items-center rounded-[5px] px-[7px] py-[4px] text-[11px] font-semibold',
  severityHigh: 'bg-[#fdecef] text-[#bd2a49]',
  severityMedium: 'bg-[#fff4da] text-[#b76a05]',
  severityLow: 'bg-[#dff7ed] text-[#078361]',
  typePost: 'mt-[8px] inline-flex max-w-full items-center rounded-[5px] bg-[#e6f0fa] px-[7px] py-[5px] text-[11px] font-semibold text-[#1a528e]',
  typeAccount: 'mt-[8px] inline-flex max-w-full items-center rounded-[5px] bg-[#eeebff] px-[7px] py-[5px] text-[11px] font-semibold text-[#6051cc]',
  reportActions: 'flex flex-wrap gap-[6px]',
  tableActions: 'mx-auto grid max-w-[120px] grid-cols-3 place-items-center gap-[6px]',
  viewAction: `${icon} hover:bg-[#e6f0fa] hover:text-[#1a528e]`,
  warningAction: `${icon} hover:bg-[#fff1cf] hover:text-[#d97706]`,
  dangerAction: `${icon} hover:bg-[#fdecef] hover:text-[#d93a5b]`,
  successAction: `${icon} hover:bg-[#d1fae5] hover:text-[#059669]`,
  warningButton: `${button} border-[#b86a06] bg-[#b86a06] text-white hover:brightness-92`,
  dangerButton: `${button} border-[#c73352] bg-[#c73352] text-white hover:brightness-92`,
  successButton: `${button} border-[#078361] bg-[#078361] text-white hover:brightness-92`,
  historyLink: 'mt-[8px] inline-flex items-center gap-[4px] border-0 bg-transparent p-0 text-[10px] font-bold text-[#1a528e] hover:underline',
  historyList: 'grid list-none gap-[8px] m-0 p-0',
  historyArticle: 'rounded-[8px] border border-solid border-[#dce4ed] bg-[#fbfcfe] px-[12px] py-[11px]',
  historyMeta: 'flex flex-wrap items-center gap-[8px]',
  historyId: 'text-[12px] font-semibold text-[#1a528e]',
  historyTime: 'text-[11px] text-[#64748b]',
  historyReason: 'my-[8px] text-[12px] leading-[1.55] text-[#334155]',
  historyReporter: 'text-[10px] text-[#8494a8]',
  evidence: 'rounded-[8px] border border-solid border-[#f0cbd2] bg-[#fff5f7] p-[16px] text-[15px] leading-[1.9] text-[#a92f4a] [overflow-wrap:anywhere]',
  hint: 'mt-[12px] mb-0 text-[12px] leading-[1.7] text-[#738298]',
}

export const reportSeverityClasses = {
  high: reportUi.severityHigh,
  medium: reportUi.severityMedium,
  low: reportUi.severityLow,
}

export const reportDialogClasses = { ...reviewDialogClasses, button: reviewUi.button }

export const reportQueueClasses = {
  toolbar: reviewUi.filterSection,
  filterFields: 'grid grid-cols-[minmax(205px,1.4fr)_repeat(2,minmax(0,1fr))] gap-x-[12px] gap-y-[10px] max-[600px]:grid-cols-2 max-[600px]:gap-[12px]',
  date: {
    container: 'w-full',
    row: 'mt-[12px] flex flex-nowrap items-end gap-[10px] border-0 border-t border-solid border-[#edf1f5] pt-[12px] max-[600px]:flex-wrap',
    label: `${reviewUi.label} max-w-[170px] flex-[0_1_170px] max-[600px]:max-w-none max-[600px]:flex-[1_1_130px]`,
    input: reviewUi.input,
    separator: 'self-end leading-[40px] text-[#9cabbc] max-[600px]:hidden',
    error: reviewUi.error,
  },
  actions: 'ml-auto flex gap-[8px] max-[600px]:basis-full max-[600px]:justify-end',
  resetButton: postUi.resetButton,
  exportButton: postUi.primaryButton,
}
