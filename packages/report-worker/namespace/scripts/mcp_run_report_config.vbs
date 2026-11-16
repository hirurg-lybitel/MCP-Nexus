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

Function mcp_MapReportClass(ByVal className)
  Dim c
  c = UCase(Trim(CStr(className)))
  If c = "TACCCARDCONFIG" Then
    mcp_MapReportClass = "TgdvAcctAccCard"
  ElseIf c = "TACCLEDGERCONFIG" Then
    mcp_MapReportClass = "TgdvAcctLedger"
  ElseIf c = "TACCCIRCULATIONLISTCONFIG" Or c = "TCIRCULATIONLISTCONFIG" Then
    mcp_MapReportClass = "TgdvAcctCirculationList"
  ElseIf c = "TACCREVIEWCONFIG" Then
    mcp_MapReportClass = "TgdvAcctAccReview"
  Else
    mcp_MapReportClass = ""
  End If
End Function

Function mcp_run_report_config(Component, Params, ByRef ResponseNo, ByRef ContentText, FormParams)
  Dim token, expected, configId, companyKey, dateBegin, dateEnd, rowLimit
  Dim className, configName, reportClass
  Dim Creator, CL, json, stepName, errMsg
  Dim d1, d2, hasBegin, hasEnd
  Dim fi, fieldCount, fieldName, fieldVal, rowJson, colJson, colFirst
  Dim emptySql, rowCount, truncated
  Dim rowParts(), rowPartCount, rowPartCap

  ResponseNo = 200
  expected = "{{MCP_WORKER_TOKEN}}"
  token = CStr(mcp_Param(Params, "token", ""))
  If token <> expected Then
    ResponseNo = 401
    ContentText.Value = "Content-Type: application/json" & vbCrLf & _
      "{""ok"":false,""error"":""UNAUTHORIZED""}"
    Exit Function
  End If

  configId = CLng(mcp_Param(Params, "configId", "0"))
  companyKey = CLng(mcp_Param(Params, "companyKey", "0"))
  dateBegin = Trim(CStr(mcp_Param(Params, "dateBegin", "")))
  dateEnd = Trim(CStr(mcp_Param(Params, "dateEnd", "")))
  rowLimit = CLng(mcp_Param(Params, "limit", "500"))
  className = Trim(CStr(mcp_Param(Params, "className", "")))
  configName = Trim(CStr(mcp_Param(Params, "configName", "")))
  reportClass = Trim(CStr(mcp_Param(Params, "reportClass", "")))
  If rowLimit <= 0 Then rowLimit = 500
  If rowLimit > 5000 Then rowLimit = 5000

  If configId <= 0 Then
    ResponseNo = 400
    ContentText.Value = "Content-Type: application/json" & vbCrLf & _
      "{""ok"":false,""error"":""MISSING_PARAMS"",""hint"":""configId required""}"
    Exit Function
  End If

  If reportClass = "" Then reportClass = mcp_MapReportClass(className)
  If reportClass = "" Then
    ResponseNo = 400
    ContentText.Value = "Content-Type: application/json" & vbCrLf & _
      "{""ok"":false,""error"":""CONFIG_UNSUPPORTED"",""className"":""" & mcp_JsonEscape(className) & """}"
    Exit Function
  End If

  hasBegin = (dateBegin <> "")
  hasEnd = (dateEnd <> "")
  If hasBegin Then d1 = mcp_ParseIsoDate(dateBegin)
  If hasEnd Then d2 = mcp_ParseIsoDate(dateEnd)

  On Error Resume Next
  stepName = "create"
  Set Creator = New TCreator
  Set CL = Creator.GetObject(nil, reportClass, "")
  If Err.Number <> 0 Or CL Is Nothing Then
    errMsg = Err.Description
    ResponseNo = 500
    ContentText.Value = "Content-Type: application/json" & vbCrLf & _
      "{""ok"":false,""error"":""CREATE_FAILED"",""reportClass"":""" & mcp_JsonEscape(reportClass) & _
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
  stepName = "load_config"
  Call CL.LoadConfig(configId)
  If Err.Number <> 0 Then
    errMsg = Err.Description
    ResponseNo = 500
    ContentText.Value = "Content-Type: application/json" & vbCrLf & _
      "{""ok"":false,""error"":""LOAD_CONFIG_FAILED"",""message"":""" & mcp_JsonEscape(errMsg) & """}"
    Set CL = Nothing
    Exit Function
  End If

  Err.Clear
  stepName = "overrides"
  If companyKey > 0 Then CL.CompanyKey = companyKey
  If hasBegin Then CL.DateBegin = d1
  If hasEnd Then CL.DateEnd = d2
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

  emptySql = ""
  On Error Resume Next
  emptySql = CStr(CL.SelectSQL.Text)
  On Error GoTo 0
  If InStr(1, emptySql, "RDB$CHARACTER_SET_NAME = '_'", 1) > 0 Then
    ResponseNo = 500
    ContentText.Value = "Content-Type: application/json" & vbCrLf & _
      "{""ok"":false,""error"":""REPORT_TOO_LARGE"",""code"":""D12""," & _
      """message"":""Worker substituted an empty report (SQL too large).""}"
    Set CL = Nothing
    Exit Function
  End If

  stepName = "serialize"
  colJson = "["
  colFirst = True
  fieldCount = 0
  On Error Resume Next
  fieldCount = CL.FieldCount
  On Error GoTo 0
  For fi = 0 To fieldCount - 1
    fieldName = ""
    On Error Resume Next
    fieldName = CStr(CL.Fields(fi).FieldName)
    On Error GoTo 0
    If fieldName <> "" Then
      If Not colFirst Then colJson = colJson & ","
      colFirst = False
      colJson = colJson & """" & mcp_JsonEscape(fieldName) & """"
    End If
  Next
  colJson = colJson & "]"

  rowPartCount = 0
  rowPartCap = 0
  rowCount = 0
  truncated = False
  If Not CL.IsEmpty Then
    CL.First
    Do While Not CL.Eof
      If rowCount >= rowLimit Then
        truncated = True
        Exit Do
      End If
      rowJson = "{"
      colFirst = True
      For fi = 0 To fieldCount - 1
        fieldName = ""
        fieldVal = ""
        On Error Resume Next
        fieldName = CStr(CL.Fields(fi).FieldName)
        fieldVal = CStr(CL.Fields(fi).AsString)
        On Error GoTo 0
        If fieldName <> "" Then
          If Not colFirst Then rowJson = rowJson & ","
          colFirst = False
          rowJson = rowJson & """" & mcp_JsonEscape(fieldName) & """:""" & mcp_JsonEscape(fieldVal) & """"
        End If
      Next
      rowJson = rowJson & "}"
      Call mcp_PushPart(rowParts, rowPartCount, rowPartCap, rowJson)
      rowCount = rowCount + 1
      CL.Next
    Loop
  End If

  json = "{""ok"":true,""source"":""ac_acct_config"",""configId"":" & configId & _
    ",""configName"":""" & mcp_JsonEscape(configName) & """" & _
    ",""className"":""" & mcp_JsonEscape(className) & """" & _
    ",""reportClass"":""" & mcp_JsonEscape(reportClass) & """"
  If companyKey > 0 Then json = json & ",""companyKey"":" & companyKey
  If hasBegin Then json = json & ",""dateBegin"":""" & dateBegin & """"
  If hasEnd Then json = json & ",""dateEnd"":""" & dateEnd & """"
  json = json & ",""columns"":" & colJson & _
    ",""rows"":[" & mcp_JoinParts(rowParts, rowPartCount, ",") & "]" & _
    ",""rowCount"":" & rowCount & _
    ",""truncated"":" & LCase(CStr(truncated)) & "}"
  ContentText.Value = "Content-Type: application/json" & vbCrLf & json
  Set CL = Nothing
  On Error GoTo 0
End Function
