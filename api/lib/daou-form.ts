// 다우오피스 "소프트웨어 개발 요청서"(formCode: IT-SW-REQ) 본문 템플릿 채우기.
// 편집기 HTML 탭 소스를 그대로 템플릿으로 두고, 데이터 컴포넌트(data-cid 3~6)의
// data-value + 안쪽 input/textarea에만 값을 주입한다.
//  - cid 3: 희망완료일  {{calendar}}  <input class="ipt_editor ipt_editor_date">
//  - cid 4: 정책문서링크 {{text}}      <input class="ipt_editor">
//  - cid 5: 요청배경     {{textarea}}  <textarea class="txta_editor">
//  - cid 6: 요청내용     {{textarea}}  <textarea class="txta_editor">
//  - cid 0/1/2(기안자/소속/기안일), 결재선, cid 7(검토의견)은 그대로 둠(자동/결재자 작성)

export interface SwReqFields {
  dueDate?: string        // YYYY-MM-DD
  policyUrl?: string
  background?: string
  requestContent?: string
}

// 속성값(value="", data-value="")용 이스케이프
function escAttr(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\r\n?/g, '\n')
    .replace(/\n/g, '&#10;')
}
// textarea 안쪽 텍스트용 이스케이프 (개행 유지)
function escText(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const RAW_TEMPLATE = `<span><span style="font-family: &quot;맑은 고딕&quot;; font-size: 10pt;">
<div style="font-family: 돋움; font-size: 9pt; line-height: 150%; margin-top: 0px; margin-bottom: 0px;">
  <span style="font-family: 돋움; font-size: 9pt;">

<div style="font-family: 돋움; font-size: 9pt; line-height: 150%; margin-top: 0px; margin-bottom: 0px;">
    <span style="font-family: 돋움; font-size: 9pt;">

<table style="border: 0px solid rgb(0, 0, 0); width: 800px; font-family: malgun gothic,dotum,arial,tahoma; margin-top: 1px; border-collapse: collapse;"><!-- Header -->
      <colgroup>
       <col width="310">
       <col width="590">
      </colgroup>

	<tbody>
		<tr>
			<td style="background: white; border: 0px; height: 90px; text-align: center; color: black; font-size: 36px; font-weight: bold; vertical-align: middle; padding: 0px !important;" colspan="2" class="dext_table_border_t dext_table_border_r dext_table_border_b dext_table_border_l">
				소프트웨어&nbsp;개발&nbsp;요청서
			</td>
		</tr>
		<tr>
			<td style="background: white; border-width: medium; border-style: none; border-color: currentcolor; border-image: initial; text-align: left; color: black; font-size: 12px; font-weight: normal; vertical-align: top; padding: 0px !important;" class="dext_table_border_t dext_table_border_r dext_table_border_b dext_table_border_l">

<table style="border: 1px solid rgb(0, 0, 0); font-family: malgun gothic,dotum,arial,tahoma; margin-top: 1px; border-collapse: collapse;"><!-- User -->
          <colgroup>
           <col width="90">
           <col width="220">
          </colgroup>

	<tbody>
		<tr>
			<td style="background: rgb(221, 221, 221); padding: 5px; border: 1px solid black; height: 18px; text-align: center; color: rgb(0, 0, 0); font-size: 12px; font-weight: bold; vertical-align: middle;">
				기안자
			</td>
			<td style="background: rgb(255, 255, 255); padding: 5px; border: 1px solid black; text-align: left; color: rgb(0, 0, 0); font-size: 12px; font-weight: normal; vertical-align: middle;">
				<span unselectable="on" contenteditable="false" class="comp_wrap" data-cid="0" data-dsl="{{label:draftUser}}" data-wrapper="" style="" data-value="" data-autotype=""><span class="comp_item">기안자</span></span>
			</td>
		</tr>
		<tr>
			<td style="background: rgb(221, 221, 221); padding: 5px; border: 1px solid black; height: 18px; text-align: center; color: rgb(0, 0, 0); font-size: 12px; font-weight: bold; vertical-align: middle;">
				소속
			</td>
			<td style="background: rgb(255, 255, 255); padding: 5px; border: 1px solid black; text-align: left; color: rgb(0, 0, 0); font-size: 12px; font-weight: normal; vertical-align: middle;">
				<span unselectable="on" contenteditable="false" class="comp_wrap" data-cid="1" data-dsl="{{label:draftDept}}" data-wrapper="" style="" data-value="" data-autotype=""><span class="comp_item">기안부서</span></span>
			</td>
		</tr>
		<tr>
			<td style="background: rgb(221, 221, 221); padding: 5px; border: 1px solid black; height: 18px; text-align: center; color: rgb(0, 0, 0); font-size: 12px; font-weight: bold; vertical-align: middle;">
				기안일
			</td>
			<td style="background: rgb(255, 255, 255); padding: 5px; border: 1px solid black; text-align: left; color: rgb(0, 0, 0); font-size: 12px; font-weight: normal; vertical-align: middle;">
				<span unselectable="on" contenteditable="false" class="comp_wrap" data-cid="2" data-dsl="{{label:draftDate}}" data-wrapper="" style="" data-value="" data-autotype=""><span class="comp_item">기안일</span></span>
			</td>
		</tr>
	</tbody>
</table>
			</td>
			<td style="background: white; border-width: medium; border-style: none; border-color: currentcolor; border-image: initial; text-align: right; color: black; font-size: 12px; font-weight: normal; vertical-align: top; padding: 0px !important;" class="dext_table_border_t dext_table_border_r dext_table_border_b dext_table_border_l">
				&nbsp; &nbsp;<span unselectable="on" contenteditable="false" class="comp_wrap" data-wrapper=""><span class="sign_type1_inline" data-group-seq="0" data-group-name="결재선" data-group-max-count="5" data-group-type="type1" data-is-reception=""><span class="sign_tit_wrap"><span class="sign_tit"><strong>결재선</strong></span></span><span class="sign_member_wrap"><span class="sign_member"><span class="sign_rank_wrap"><span class="sign_rank" style="font-family: &quot;malgun gothic&quot;, dotum, arial, tahoma; font-size: 9pt;">&nbsp;</span></span><span class="sign_wrap" style="font-family: &quot;malgun gothic&quot;, dotum, arial, tahoma; font-size: 9pt;">&nbsp;</span><span class="sign_date_wrap"><span class="sign_date" style="font-family: &quot;malgun gothic&quot;, dotum, arial, tahoma; font-size: 9pt;">&nbsp;</span></span></span></span><span class="sign_member_wrap"><span class="sign_member"><span class="sign_rank_wrap"><span class="sign_rank" style="font-family: &quot;malgun gothic&quot;, dotum, arial, tahoma; font-size: 9pt;">&nbsp;</span></span><span class="sign_wrap" style="font-family: &quot;malgun gothic&quot;, dotum, arial, tahoma; font-size: 9pt;">&nbsp;</span><span class="sign_date_wrap"><span class="sign_date" style="font-family: &quot;malgun gothic&quot;, dotum, arial, tahoma; font-size: 9pt;">&nbsp;</span></span></span></span><span class="sign_member_wrap"><span class="sign_member"><span class="sign_rank_wrap"><span class="sign_rank" style="font-family: &quot;malgun gothic&quot;, dotum, arial, tahoma; font-size: 9pt;">&nbsp;</span></span><span class="sign_wrap" style="font-family: &quot;malgun gothic&quot;, dotum, arial, tahoma; font-size: 9pt;">&nbsp;</span><span class="sign_date_wrap"><span class="sign_date" style="font-family: &quot;malgun gothic&quot;, dotum, arial, tahoma; font-size: 9pt;">&nbsp;</span></span></span></span><span class="sign_member_wrap"><span class="sign_member"><span class="sign_rank_wrap"><span class="sign_rank" style="font-family: &quot;malgun gothic&quot;, dotum, arial, tahoma; font-size: 9pt;">&nbsp;</span></span><span class="sign_wrap" style="font-family: &quot;malgun gothic&quot;, dotum, arial, tahoma; font-size: 9pt;">&nbsp;</span><span class="sign_date_wrap"><span class="sign_date" style="font-family: &quot;malgun gothic&quot;, dotum, arial, tahoma; font-size: 9pt;">&nbsp;</span></span></span></span><span class="sign_member_wrap"><span class="sign_member"><span class="sign_rank_wrap"><span class="sign_rank" style="font-family: &quot;malgun gothic&quot;, dotum, arial, tahoma; font-size: 9pt;">&nbsp;</span></span><span class="sign_wrap" style="font-family: &quot;malgun gothic&quot;, dotum, arial, tahoma; font-size: 9pt;">&nbsp;</span><span class="sign_date_wrap"><span class="sign_date" style="font-family: &quot;malgun gothic&quot;, dotum, arial, tahoma; font-size: 9pt;">&nbsp;</span></span></span></span></span></span>
			</td>
		</tr>
	</tbody>
</table>

<table style="border: 0px solid rgb(0, 0, 0); width: 801px; font-family: &quot;malgun gothic&quot;, dotum, arial, tahoma; margin-top: 10px; border-collapse: collapse;"><!-- Data1 -->
      <colgroup>
       <col width="140">
       <col width="260">
       <col width="140">
       <col width="260">
      </colgroup>

	<tbody>
		<tr>
			<td style="background: rgb(221, 221, 221); padding: 5px; border: 1px solid black; height: 25px; text-align: center; color: rgb(0, 0, 0); font-size: 14px; font-weight: bold; vertical-align: middle;">
				<p style="font-family: &quot;malgun gothic&quot;, dotum, arial, tahoma; font-size: 11pt; line-height: 150%; margin-top: 0px; margin-bottom: 0px;">희망 완료일</p>
			</td>
			<td colspan="5" style="background: rgb(255, 255, 255); padding: 5px; border: 1px solid black; text-align: left; color: rgb(0, 0, 0); font-size: 14px; font-weight: normal; vertical-align: middle;">
				<p style="font-family: &quot;malgun gothic&quot;, dotum, arial, tahoma; font-size: 11pt; line-height: 150%; margin-top: 0px; margin-bottom: 0px;"><span unselectable="on" contenteditable="false" class="comp_wrap" data-cid="3" data-dsl="{{calendar}}" data-wrapper="" style="" data-value="__DUE_ATTR__"><input class="ipt_editor ipt_editor_date" type="text" value="__DUE_VAL__"></span><br></p>
			</td>
		</tr>
		<tr>
			<td style="background: rgb(221, 221, 221); padding: 5px; border: 1px solid black; height: 25px; text-align: center; color: rgb(0, 0, 0); font-size: 14px; font-weight: bold; vertical-align: middle;">
				<p style="font-family: &quot;malgun gothic&quot;, dotum, arial, tahoma; font-size: 11pt; line-height: 150%; margin-top: 0px; margin-bottom: 0px;">정책문서링크</p>
			</td>
			<td colspan="5" style="background: rgb(255, 255, 255); padding: 5px; border: 1px solid black; text-align: left; color: rgb(0, 0, 0); font-size: 14px; font-weight: normal; vertical-align: middle;">
				<p style="font-family: &quot;malgun gothic&quot;, dotum, arial, tahoma; font-size: 11pt; line-height: 150%; margin-top: 0px; margin-bottom: 0px;"><span unselectable="on" contenteditable="false" class="comp_wrap" data-cid="4" data-dsl="{{text}}" data-wrapper="" style="width: 100%;" data-value="__POLICY_ATTR__"><input class="ipt_editor" type="text" value="__POLICY_VAL__"></span><br></p>
			</td>
		</tr>
		<tr>
			<td style="background: rgb(221, 221, 221); padding: 5px; border: 1px solid black; height: 25px; text-align: center; color: rgb(0, 0, 0); font-size: 14px; font-weight: bold; vertical-align: middle;">
				<p style="font-family: &quot;malgun gothic&quot;, dotum, arial, tahoma; font-size: 11pt; line-height: 150%; margin-top: 0px; margin-bottom: 0px;">요청 배경</p>
			</td>
			<td colspan="5" style="background: rgb(255, 255, 255); padding: 5px; border: 1px solid black; text-align: left; color: rgb(0, 0, 0); font-size: 14px; font-weight: normal; vertical-align: middle;">
				<p style="font-family: &quot;malgun gothic&quot;, dotum, arial, tahoma; font-size: 11pt; line-height: 150%; margin-top: 0px; margin-bottom: 0px;"><span unselectable="on" contenteditable="false" class="comp_wrap" data-cid="5" data-dsl="{{textarea}}" data-wrapper="" style="width: 100%;" data-value="__BG_ATTR__"><textarea class="txta_editor">__BG_VAL__</textarea></span><br></p>
			</td>
		</tr>
		<tr>
			<td style="background: rgb(221, 221, 221); padding: 5px; border: 1px solid black; height: 25px; text-align: center; color: rgb(0, 0, 0); font-size: 14px; font-weight: bold; vertical-align: middle;">
				요청 내용
			</td>
			<td style="background: rgb(255, 255, 255); padding: 5px; border: 1px solid black; text-align: left; color: rgb(0, 0, 0); font-size: 14px; font-weight: normal; vertical-align: middle;" colspan="3">
				<span unselectable="on" contenteditable="false" class="comp_wrap" data-cid="6" data-dsl="{{textarea}}" data-wrapper="" style="width: 100%;" data-value="__RC_ATTR__"><textarea class="txta_editor">__RC_VAL__</textarea></span>
			</td>
		</tr>
		<tr>
			<td style="background: rgb(221, 221, 221); padding: 5px; border: 1px solid black; height: 60px; text-align: center; color: rgb(0, 0, 0); font-size: 14px; font-weight: bold; vertical-align: middle;">
				검토 의견
			</td>
			<td style="background: rgb(255, 255, 255); padding: 5px; border: 1px solid black; text-align: left; color: rgb(0, 0, 0); font-size: 14px; font-weight: normal; vertical-align: top;" colspan="3">
				<span unselectable="on" contenteditable="false" class="comp_wrap" data-cid="7" data-dsl="{{textarea}}" data-wrapper="" style="width: 100%;" data-value=""><textarea class="txta_editor"></textarea></span>
			</td>
		</tr>
	</tbody>
</table>
     <br></span>
   </div>
<div style="font-family: 돋움; font-size: 9pt; line-height: 150%; margin-top: 0px; margin-bottom: 0px;"><span style="font-family: 돋움; font-size: 9pt;"></span></div></span></div>·&nbsp;본&nbsp;문서는&nbsp;소프트웨어(서비스&nbsp;또는&nbsp;시스템)&nbsp;개발을&nbsp;요청하는&nbsp;문서입니다.<br>·&nbsp;신규/수정&nbsp;개발이&nbsp;필요한&nbsp;내용을&nbsp;구체적으로&nbsp;작성&nbsp;합니다.<br>·&nbsp;IT개발실장&nbsp;결재시&nbsp;개발&nbsp;책임&nbsp;선정하여&nbsp;검토의견&nbsp;기록<br>·&nbsp;결재선:&nbsp;기안자&nbsp;&gt;&nbsp;기안&nbsp;부서장&nbsp;&gt;&nbsp;PM&nbsp;&gt;&nbsp;IT개발실장<br>·&nbsp;기안&nbsp;승인&nbsp;후&nbsp;요청&nbsp;배경,&nbsp;요청&nbsp;내용&nbsp;등이&nbsp;변경되는&nbsp;경우&nbsp;반드시&nbsp;기존&nbsp;기안을&nbsp;수정해주세요.<br>&nbsp;*&nbsp;필수&nbsp;참조&nbsp;부서: IT개발실a<p style="font-family: &quot;맑은 고딕&quot;; font-size: 10pt; line-height: 150%; margin-top: 0px; margin-bottom: 0px;"><br></p></span><p style="font-family: &quot;맑은 고딕&quot;; font-size: 10pt; line-height: 150%; margin-top: 0px; margin-bottom: 0px;"><br></p></span>`

export function buildSwReqContent(f: SwReqFields): string {
  return RAW_TEMPLATE
    .replace('__DUE_ATTR__', escAttr(f.dueDate ?? ''))
    .replace('__DUE_VAL__', escAttr(f.dueDate ?? ''))
    .replace('__POLICY_ATTR__', escAttr(f.policyUrl ?? ''))
    .replace('__POLICY_VAL__', escAttr(f.policyUrl ?? ''))
    .replace('__BG_ATTR__', escAttr(f.background ?? ''))
    .replace('__BG_VAL__', escText(f.background ?? ''))
    .replace('__RC_ATTR__', escAttr(f.requestContent ?? ''))
    .replace('__RC_VAL__', escText(f.requestContent ?? ''))
}
