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

Function mcp_account_review(Component, Params, ByRef ResponseNo, ByRef ContentText, FormParams)
  Dim token, expected, companyKey, dateBegin, dateEnd, accountKey
  Dim includeInternal, allHolding, Creator, CL, json
  Dim d1, d2, stepName, errMsg
  Dim aliasName, corrAlias, ncuDebit, ncuCredit
  Dim saldoBegin, saldoEnd
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
  Dim withSubAccounts
  includeInternal = (CStr(mcp_Param(Params, "includeInternal", "0")) = "1")
  allHolding = (CStr(mcp_Param(Params, "allHoldingCompanies", "0")) = "1")
  withSubAccounts = (CStr(mcp_Param(Params, "withSubAccounts", "1")) = "1")

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
  Set CL = Creator.GetObject(nil, "TgdvAcctAccReview", "")
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
  CL.WithCorrSubAccounts = True
  Call CL.ShowInNcu(True, 4, 1)
  Call CL.AddAccount(CLng(accountKey))
  If Err.Number <> 0 Then
    errMsg = Err.Description
    ResponseNo = 500
    ContentText.Value = "Content-Type: application/json" & vbCrLf & _
      "{""ok"":false,""error"":""PARAM_FAILED"",""message"":""" & mcp_JsonEscape(errMsg) & """}"
    Set CL = Nothing
    Exit Function
  End If

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

  Dim emptySql
  emptySql = ""
  On Error Resume Next
  emptySql = CStr(CL.SelectSQL.Text)
  On Error GoTo 0
  If InStr(1, emptySql, "RDB$CHARACTER_SET_NAME = '_'", 1) > 0 Then
    ResponseNo = 500
    ContentText.Value = "Content-Type: application/json" & vbCrLf & _
      "{""ok"":false,""error"":""REPORT_TOO_LARGE"",""code"":""D12""," & _
      """message"":""Worker substituted an empty report (SQL too large). Narrow accounts/period.""}"
    Set CL = Nothing
    Exit Function
  End If

  Err.Clear
  stepName = "serialize"
  saldoBegin = "0"
  saldoEnd = "0"
  On Error Resume Next
  saldoBegin = mcp_Num(CL.SaldoBeginNcu)
  saldoEnd = mcp_Num(CL.SaldoEndNcu)
  On Error GoTo 0

  rowPartCount = 0
  rowPartCap = 0
  If Not CL.IsEmpty Then
    CL.First
    Do While Not CL.Eof
      aliasName = ""
      corrAlias = ""
      ncuDebit = "0"
      ncuCredit = "0"
      On Error Resume Next
      aliasName = CStr(CL.FieldByName("ALIAS").AsString)
      corrAlias = CStr(CL.FieldByName("CORRALIAS").AsString)
      ncuDebit = mcp_Num(CL.FieldByName("NCU_DEBIT").AsString)
      ncuCredit = mcp_Num(CL.FieldByName("NCU_CREDIT").AsString)
      On Error GoTo 0

      rowJson = "{""alias"":""" & mcp_JsonEscape(aliasName) & """" & _
        ",""corrAlias"":""" & mcp_JsonEscape(corrAlias) & """" & _
        ",""ncuDebit"":" & ncuDebit & _
        ",""ncuCredit"":" & ncuCredit & "}"
      Call mcp_PushPart(rowParts, rowPartCount, rowPartCap, rowJson)
      CL.Next
    Loop
  End If

  json = "{""ok"":true,""source"":""tgdv_acct_acc_review"",""companyKey"":" & companyKey & _
    ",""accountKey"":" & accountKey & _
    ",""dateBegin"":""" & dateBegin & """,""dateEnd"":""" & dateEnd & """" & _
    ",""includeInternal"":" & LCase(CStr(includeInternal)) & _
    ",""saldoBeginNcu"":" & saldoBegin & _
    ",""saldoEndNcu"":" & saldoEnd & _
    ",""rows"":[" & mcp_JoinParts(rowParts, rowPartCount, ",") & "]}"

  ContentText.Value = "Content-Type: application/json" & vbCrLf & json
  Set CL = Nothing
  On Error GoTo 0
End Function
