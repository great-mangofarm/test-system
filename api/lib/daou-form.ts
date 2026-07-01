// 다우오피스 "소프트웨어 개발 요청서"(formCode: IT-SW-REQ) 연동 본문 생성.
// 양식에 <div data-id="appContent">가 있으면 API의 content(HTML)가 그 안에 그대로 렌더링된다.
// 요청 항목(희망완료일/정책문서/요청배경/요청내용)을 표 HTML로 만들어 반환한다.
// 표 셀 스타일은 양식의 다른 행(검토 의견 등)과 동일하게 맞춰 줄을 맞춘다.

export interface SwReqFields {
  dueDate?: string
  policyUrl?: string
  background?: string
  requestContent?: string
}

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
// URL 자동 링크 + 개행 <br> (텍스트 부분은 이스케이프)
function linkifyMultiline(s: string): string {
  const parts = String(s ?? '').split(/(https?:\/\/[^\s<]+)/g)
  return parts
    .map((p, i) => {
      if (i % 2 === 1) {
        // URL 부분
        return `<a href="${esc(p)}" style="color: rgb(37,99,235); text-decoration: underline;">${esc(p)}</a>`
      }
      return esc(p).replace(/\r\n?/g, '\n').replace(/\n/g, '<br>')
    })
    .join('')
}

// 양식 데이터 셀과 동일한 스타일 (검토 의견 행과 줄맞춤)
const TD_LABEL =
  'background: rgb(221, 221, 221); padding: 5px; border: 1px solid black; width: 140px; text-align: center; color: rgb(0, 0, 0); font-size: 14px; font-weight: bold; vertical-align: middle;'
const TD_VALUE =
  'background: rgb(255, 255, 255); padding: 5px; border: 1px solid black; text-align: left; color: rgb(0, 0, 0); font-size: 14px; font-weight: normal; vertical-align: top; word-break: break-all; overflow-wrap: break-word;'

export function buildSwReqContent(f: SwReqFields): string {
  const rows: string[] = []
  rows.push(
    `<tr><td style="${TD_LABEL}">희망 완료일</td><td style="${TD_VALUE}">${esc(f.dueDate ?? '')}</td></tr>`,
  )
  if (f.policyUrl) {
    rows.push(
      `<tr><td style="${TD_LABEL}">정책문서링크</td><td style="${TD_VALUE}">${linkifyMultiline(f.policyUrl)}</td></tr>`,
    )
  }
  rows.push(
    `<tr><td style="${TD_LABEL}">요청 배경</td><td style="${TD_VALUE}">${linkifyMultiline(f.background ?? '')}</td></tr>`,
  )
  rows.push(
    `<tr><td style="${TD_LABEL}">요청 내용</td><td style="${TD_VALUE}">${linkifyMultiline(f.requestContent ?? '')}</td></tr>`,
  )
  return `<table style="width: 100%; table-layout: fixed; border-collapse: collapse; margin: 0px; font-family: &quot;malgun gothic&quot;, dotum, arial, tahoma;"><colgroup><col style="width: 140px;"><col></colgroup><tbody>${rows.join('')}</tbody></table>`
}
