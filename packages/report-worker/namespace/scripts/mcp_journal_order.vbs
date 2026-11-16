'#include mcp_JsonEscape
Option Explicit

Function mcp_Num(ByVal v)
  Dim s
  If IsNull(v) Then
    mcp_Num = "0"
    Exit Function
  End If
  s = CStr(v)
  s = Replace(s, " ", "")
  s = Replace(s, ",", ".")
  If s = "" Then s = "0"
  mcp_Num = s
End Function

Function mcp_ParseIsoDate(ByVal s)
  Dim p
  p = Split(Trim(CStr(s)), "-")
  If UBound(p) < 2 Then
    Err.Raise 1001, , "Invalid date, expected YYYY-MM-DD"
  End If
  mcp_ParseIsoDate = DateSerial(CInt(p(0)), CInt(p(1)), CInt(p(2)))
End Function

Function mcp_Param(Params, ByVal key, ByVal defaultValue)
  Dim v
  On Error Resume Next
  v = Params.Values(key)
  If Err.Number <> 0 Then
    Err.Clear
    v = ""
  End If
  On Error GoTo 0
  If Trim(CStr(v)) = "" Then
    mcp_Param = defaultValue
  Else
    mcp_Param = v
  End If
End Function

' D12: after LargeSQL the platform substitutes DoEmptySQL with this sentinel.
Function mcp_IsEmptyReportSubstitute(CL)
  Dim sqlText
  sqlText = ""
  On Error Resume Next
  sqlText = CStr(CL.SelectSQL.Text)
  On Error GoTo 0
  mcp_IsEmptyReportSubstitute = (InStr(1, sqlText, "RDB$CHARACTER_SET_NAME = '_'", 1) > 0)
End Function

Function mcp_FieldJson(ByVal fname, ByVal fval)
  Dim u, isMoney
  u = UCase(fname)
  isMoney = (InStr(u, "NCU_") = 1) Or (InStr(u, "CURR_") = 1) Or (InStr(u, "EQ_") = 1) Or _
    (InStr(u, "DEBIT") > 0) Or (InStr(u, "CREDIT") > 0)
  If isMoney Then
    mcp_FieldJson = """" & mcp_JsonEscape(fname) & """:" & mcp_Num(fval)
  Else
    mcp_FieldJson = """" & mcp_JsonEscape(fname) & """:""" & mcp_JsonEscape(CStr(fval)) & """"
  End If
End Function

Sub mcp_PushPart(ByRef parts, ByRef partCount, ByRef partCap, ByVal s)
  If partCount >= partCap Then
    If partCap = 0 Then
      partCap = 256
      ReDim parts(255)
    Else
      partCap = partCap * 2
      ReDim Preserve parts(partCap - 1)
    End If
  End If
  parts(partCount) = s
  partCount = partCount + 1
End Sub

Function mcp_JoinParts(ByRef parts, ByVal partCount, ByVal sep)
  If partCount <= 0 Then
    mcp_JoinParts = ""
    Exit Function
  End If
  ReDim Preserve parts(partCount - 1)
  mcp_JoinParts = Join(parts, sep)
End Function

Function mcp_journal_order(Component, Params, ByRef ResponseNo, ByRef ContentText, FormParams)
  Dim token, expected, companyKey, dateBegin, dateEnd, accountKey
  Dim includeInternal, allHolding, showDebit, showCredit, Creator, CL, json
  Dim d1, d2, stepName, errMsg
  Dim fi, fieldCount, fname, fval, rowFirst, FieldsObj, FieldObj
  Dim rowParts(), rowPartCount, rowPartCap, rowJson

  ResponseNo = 200
  expected = "{{MCP_WORKER_TOKEN}}"
  token = CStr(mcp_Param(Params, "token", ""))
  If token <> expected Then
    ResponseNo = 401
    ContentText.Value = "Content-Type: application/json" & vbCrLf & _
      "{""ok"":false,""error"":""UNAUTHORIZED""}"
    Exit Function
  End If

  companyKey = CLng(mcp_Param(Params, "companyKey", "0"))
  dateBegin = Trim(CStr(mcp_Param(Params, "dateBegin", "")))
  dateEnd = Trim(CStr(mcp_Param(Params, "dateEnd", "")))
  accountKey = Trim(CStr(mcp_Param(Params, "accountKey", "")))
  Dim groupBy, withSubAccounts
  includeInternal = (CStr(mcp_Param(Params, "includeInternal", "0")) = "1")
  allHolding = (CStr(mcp_Param(Params, "allHoldingCompanies", "0")) = "1")
  withSubAccounts = (CStr(mcp_Param(Params, "withSubAccounts", "1")) = "1")
  showDebit = (CStr(mcp_Param(Params, "showDebit", "1")) = "1")
  showCredit = (CStr(mcp_Param(Params, "showCredit", "1")) = "1")
  ' Ledger refuses empty analytics group (MSG_INPUTANGROUPANALYTIC).
  groupBy = UCase(Trim(CStr(mcp_Param(Params, "groupBy", "ENTRYDATE"))))
  If groupBy = "" Then groupBy = "ENTRYDATE"

  If companyKey <= 0 Or dateBegin = "" Or dateEnd = "" Or accountKey = "" Or accountKey = "0" Then
    ResponseNo = 400
    ContentText.Value = "Content-Type: application/json" & vbCrLf & _
      "{""ok"":false,""error"":""MISSING_PARAMS"",""hint"":""companyKey,dateBegin,dateEnd,accountKey required""}"
    Exit Function
  End If

  stepName = "parse_dates"
  d1 = mcp_ParseIsoDate(dateBegin)
  d2 = mcp_ParseIsoDate(dateEnd)

  On Error Resume Next
  stepName = "create"
  Set Creator = New TCreator
  Set CL = Creator.GetObject(nil, "TgdvAcctLedger", "")
  If Err.Number <> 0 Or CL Is Nothing Then
    errMsg = Err.Description
    ResponseNo = 500
    ContentText.Value = "Content-Type: application/json" & vbCrLf & _
      "{""ok"":false,""error"":""CREATE_FAILED"",""step"":""" & stepName & _
      """,""message"":""" & mcp_JsonEscape(errMsg) & """}"
    Exit Function
  End If

  Err.Clear
  stepName = "bind_db"
  Set CL.Database = gdcBaseManager.Database
  Set CL.ReadTransaction = gdcBaseManager.ReadTransaction
  If Err.Number <> 0 Then
    errMsg = Err.Description
    ResponseNo = 500
    ContentText.Value = "Content-Type: application/json" & vbCrLf & _
      "{""ok"":false,""error"":""BIND_FAILED"",""message"":""" & mcp_JsonEscape(errMsg) & """}"
    Set CL = Nothing
    Exit Function
  End If

  Err.Clear
  stepName = "params"
  CL.CompanyKey = companyKey
  CL.DateBegin = d1
  CL.DateEnd = d2
  CL.AllHolding = allHolding
  CL.IncludeInternalMovement = includeInternal
  CL.WithSubAccounts = withSubAccounts
  CL.ShowCorrSubAccounts = True
  CL.ShowDebit = showDebit
  CL.ShowCredit = showCredit
  CL.SumNull = False
  CL.EnchancedSaldo = False
  Call CL.ShowInNcu(True, 4, 1)
  Call CL.ShowInCurr(False, 4, 1)
  Call CL.ShowInEQ(False, 4, 1)
  Call CL.AddAccount(CLng(accountKey))
  Call CL.AddGroupBy(groupBy)
  ' Platform bug: UseEntryBalance + empty AccWhereQuantity emits bare HAVING.
  ' AddValue forces the legacy SQL path (FAcctValues.Count > 0).
  Call CL.AddValue(1, "mcp_legacy_path")
  If Err.Number <> 0 Then
    errMsg = Err.Description
    ResponseNo = 500
    ContentText.Value = "Content-Type: application/json" & vbCrLf & _
      "{""ok"":false,""error"":""PARAM_FAILED"",""message"":""" & mcp_JsonEscape(errMsg) & """}"
    Set CL = Nothing
    Exit Function
  End If
  On Error Resume Next
  CL.UseEntryBalance = False
  Err.Clear
  On Error GoTo 0

  Err.Clear
  stepName = "build"
  Call CL.BuildReport
  If Err.Number <> 0 Then
    errMsg = Err.Description
    ResponseNo = 500
    ContentText.Value = "Content-Type: application/json" & vbCrLf & _
      "{""ok"":false,""error"":""BUILD_FAILED"",""message"":""" & mcp_JsonEscape(errMsg) & """}"
    Set CL = Nothing
    Exit Function
  End If

  If mcp_IsEmptyReportSubstitute(CL) Then
    ResponseNo = 500
    ContentText.Value = "Content-Type: application/json" & vbCrLf & _
      "{""ok"":false,""error"":""REPORT_TOO_LARGE"",""code"":""D12""," & _
      """message"":""Worker substituted an empty report (SQL too large). Narrow accounts/period.""}"
    Set CL = Nothing
    Exit Function
  End If

  Err.Clear
  stepName = "serialize"
  rowPartCount = 0
  rowPartCap = 0
  If Not CL.IsEmpty Then
    CL.First
    Do While Not CL.Eof
      rowJson = "{"
      rowFirst = True
      fieldCount = 0
      On Error Resume Next
      fieldCount = CL.FieldCount
      Set FieldsObj = CL.Fields
      On Error GoTo 0
      If fieldCount > 0 Then
        For fi = 0 To fieldCount - 1
          fname = ""
          fval = ""
          On Error Resume Next
          Set FieldObj = Nothing
          Set FieldObj = FieldsObj.Fields(fi)
          If FieldObj Is Nothing Then Set FieldObj = CL.Fields(fi)
          If Not FieldObj Is Nothing Then
            fname = CStr(FieldObj.FieldName)
            fval = CStr(FieldObj.AsString)
          End If
          On Error GoTo 0
          If fname <> "" Then
            If Not rowFirst Then rowJson = rowJson & ","
            rowFirst = False
            rowJson = rowJson & mcp_FieldJson(fname, fval)
          End If
        Next
      Else
        ' Fallback: core ledger totals only
        On Error Resume Next
        rowJson = rowJson & mcp_FieldJson("ALIAS", CL.FieldByName("ALIAS").AsString)
        rowJson = rowJson & "," & mcp_FieldJson("NCU_BEGIN_DEBIT", CL.FieldByName("NCU_BEGIN_DEBIT").AsString)
        rowJson = rowJson & "," & mcp_FieldJson("NCU_BEGIN_CREDIT", CL.FieldByName("NCU_BEGIN_CREDIT").AsString)
        rowJson = rowJson & "," & mcp_FieldJson("NCU_DEBIT", CL.FieldByName("NCU_DEBIT").AsString)
        rowJson = rowJson & "," & mcp_FieldJson("NCU_CREDIT", CL.FieldByName("NCU_CREDIT").AsString)
        rowJson = rowJson & "," & mcp_FieldJson("NCU_END_DEBIT", CL.FieldByName("NCU_END_DEBIT").AsString)
        rowJson = rowJson & "," & mcp_FieldJson("NCU_END_CREDIT", CL.FieldByName("NCU_END_CREDIT").AsString)
        On Error GoTo 0
      End If
      rowJson = rowJson & "}"
      Call mcp_PushPart(rowParts, rowPartCount, rowPartCap, rowJson)
      CL.Next
    Loop
  End If

  json = "{""ok"":true,""source"":""tgdv_acct_ledger"",""companyKey"":" & companyKey & _
    ",""accountKey"":" & accountKey & _
    ",""dateBegin"":""" & dateBegin & """,""dateEnd"":""" & dateEnd & """" & _
    ",""includeInternal"":" & LCase(CStr(includeInternal)) & _
    ",""showDebit"":" & LCase(CStr(showDebit)) & _
    ",""showCredit"":" & LCase(CStr(showCredit)) & _
    ",""groupBy"":""" & mcp_JsonEscape(groupBy) & """" & _
    ",""rows"":[" & mcp_JoinParts(rowParts, rowPartCount, ",") & "]}"

  ContentText.Value = "Content-Type: application/json" & vbCrLf & json
  Set CL = Nothing
  On Error GoTo 0
End Function
