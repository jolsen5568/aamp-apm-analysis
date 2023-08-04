/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define(['N/email', 'N/file', 'N/format', 'N/format/i18n', 'N/https', 'N/log', 'N/record', 'N/runtime', 'N/search',
    '../lib/moment.min.js' ],
    /**
 * @param{email} email
 * @param{file} file
 * @param{format} format
 * @param{i18n} i18n
 * @param{https} https
 * @param{log} log
 * @param{record} record
 * @param{runtime} runtime
 * @param{search} search
 * @param{moment} moment
 */
    (email, file, format, i18n, https, log, record, runtime, search, moment) => {

        /**
         * Defines the Scheduled script trigger point.
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - Script execution context. Use values from the scriptContext.InvocationType enum.
         * @since 2015.2
         */
        const getScriptParameters = () => {
            const script = runtime.getCurrentScript();
            return {
                EMPLOYEE_EMAIL_GROUP_ID: script.getParameter({
                    name: "custscript_employee_email_group_id",
                }),
                CREATE_CSV_FILE: script.getParameter({
                    name: "custscript_apm_analysis_create_csv",
                }),
                CSV_REPORTS_FOLDER: script.getParameter({
                    name: "custscript_apm_analysis_csv_folder_id",
                }),
                EMAIL_DISTRIBUTION_LIST: script.getParameter({
                    name: "custscript_apm_analysis_dist_list"
                })
            };
        };


        /**
         * Defines the Scheduled script trigger point.
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - Script execution context. Use values from the scriptContext.InvocationType enum.
         * @since 2015.2
         */
        const execute = (scriptContext) => {
            const TAG = 'AAMP_AMP_Performance Analysis - execute';
            var c = 0;
            var csvContent;
            var items = new Array();
            var csvContent;
            var timePerLine;
            var lineCntr = 1;
            var employeeList;
            var employee;

            const { EMAIL_DISTRIBUTION_LIST, CREATE_CSV_FILE, CSV_REPORTS_FOLDER, EMPLOYEE_EMAIL_GROUP_ID } = getScriptParameters();

            try {
                let sn_setBy;
                let sn_record;
                let sn_date;
                let sn_context;
                let sn_type;

                var downloadedFile = file.load({
                    id: 9266684
                });
                //var csvFileContent = downloadedFile.getContents();
                log.debug(TAG, JSON.stringify(downloadedFile));

                employeeList = getEmployeeList();
                log.debug(TAG, 'employeeList : ' + employeeList.length);

                let c = 0;
                downloadedFile.lines.iterator().each(function (line) {
                    log.debug(TAG, 'I am executing on line ' + c);
                    var w = line.value.split(",");
                    var empId;
                    if(c > 0){
                        //
                        // let item = items.find(item => item.itmName === prodName);
                        // let itmIndex = items.findIndex(x => x.itmName === prodName);

                        //let employee = employeeList.find(employee => csvLineItem.email === w[1]);
                        let employee = employeeList.find(x => x.email === w[1]);
                        let itmIndex = items.findIndex(x => x.email === w[1]);

                        log.debug(TAG, 'Did I find the employee : ' + employee.empid);

                        // if(!isEmpty(employee.empid)){
                        //     empId = getEmployeeIntIdById(w[1]);
                        // }

                        let fromDate = moment(w[0]).format('M/D/YYYY, h:mm a').replace(',','');
                        let toDate = moment(w[0]).add(1, 'minutes').format('M/D/YYYY, h:mm a').replace(',','');
                        log.debug(TAG, 'fromDate : ' + fromDate);
                        log.debug(TAG, 'toDate : ' + toDate);

                        var systemNotesObj = getSystemNotesObject(employee.empid, fromDate, toDate);
                        var searchResultCount = systemNotesObj.runPaged().count;
                        log.debug("systemNotesObj result count",searchResultCount);
                        let cnt = 0;
                        systemNotesObj.run().each(function(result){

                            sn_setBy = result.getText({
                                name: "name", label: "Set by"
                            });
                            sn_record = result.getValue({
                                name: "record", label: "Record"
                            });
                            sn_date = result.getValue({
                                name: "date", label: "Date"
                            });
                            sn_context = result.getValue({
                                name: "context", label: "Context"
                            });
                            sn_type = result.getValue({
                                name: "type", label: "Type"
                            });

                            let chkRecord = sn_record.split('#');
                            if(isEmpty(chkRecord[1])) return true;
                        });
                        log.debug(TAG, 'sn_record : ' + sn_record);
                        var splitRecord;

                        try{
                            splitRecord = sn_record.split('#');
                            var orderObj = getSalesOrderObject(splitRecord[1]);
                            var orderObjCount = orderObj.runPaged().count;
                            log.debug("orderObjCount result count",searchResultCount);

                            items.push(new csvLineItem(w[0], w[1], employee.empid, w[2], w[3], w[4], w[5], w[6], w[7], sn_setBy.replace(',', '-'), sn_record,
                                sn_date, sn_context, sn_type, orderObjCount));
                        } catch (error) {
                            items.push(new csvLineItem(w[0], w[1], employee.empid, w[2], w[3], w[4], w[5], w[6], w[7]));
                        }
                    }
                    c++;
                    return true;
                });

                // output

                csvContent = 'LineId, ' +
                    'Date, ' +
                    'Email, ' +
                    'Employee ID, ' +
                    'Client, ' +
                    'Network, ' +
                    'Suite Script, ' +
                    'Workflow, ' +
                    'Server, ' +
                    'Total, ' +
                    'Set By, ' +
                    'Record, ' +
                    'Sys Note Date, ' +
                    'Context, ' +
                    'Type, ' +
                    'Number Of Records, ' +
                    'Record Save Time'  + "\n";

                if(CREATE_CSV_FILE){
                    log.debug(TAG, 'Output..........');

                    for(let i =0;i < items.length;i++){
                        // log.debug(TAG, 'date : ' + items[i].dateTime);
                        // log.debug(TAG, 'setBy : ' + items[i].sn_setby);
                        // log.debug(TAG, 'snRecord : ' + items[i].sn_record);
                        timePerLine = 0;
                        if(!isEmpty(items[i].total) && !isEmpty(items[i].sn_lines)){
                            timePerLine = parseFloat(items[i].total) / parseInt(items[i].sn_lines);
                        }

                        csvContent += lineCntr + ',' + items[i].dateTime + ',' + items[i].email + ',' + items[i].empid + ',' +
                            items[i].client + ',' + items[i].network + ','  + items[i].suitescript + ',' + items[i].workflow + ',' +
                            items[i].server + ',' + items[i].total + ','  + items[i].sn_setby + ',' + items[i].sn_record + ',' + items[i].sn_date + ',' +
                            items[i].sn_context + ',' +  sn_type + ',' +
                            items[i].sn_lines + ',' +  timePerLine +  "\n";

                        lineCntr++;
                    }
                }
                log.debug(TAG, JSON.stringify(items));
                var dateTime = new Date();
                var fileObj = file.create({
                    name:  downloadedFile.name.replace(".csv", "") + '_' + dateTime + '.CSV',
                    fileType: file.Type.CSV,
                    contents: csvContent
                });

                fileObj.folder = parseInt(CSV_REPORTS_FOLDER);
                let fileId = fileObj.save();
                log.debug(TAG, 'CSV File ID : ' + fileId);
            } catch (e) {
                log.debug(TAG, e.message);
            }
        }

        function csvLineItem(dateTime, email, empid, client, network, suitescript, workflow, server, total,
                             sn_setby, sn_record, sn_date, sn_context, sn_type, sn_lines){
            const TAG = 'AAMP_AMP_Performance Analysis - csvLineItem';
            try{
                this.dateTime = dateTime;
                this.email =  email;
                this.empid = empid;
                this.client = client;
                this.network = network;
                this.suitescript = suitescript;
                this.workflow = workflow;
                this.server = server;
                this.total = total;
                this.sn_setby = sn_setby;
                this.sn_record = sn_record;
                this.sn_date = sn_date;
                this.sn_context = sn_context;
                this.sn_type = sn_type;
                this.sn_lines = sn_lines;
            } catch (e) {
                log.debug(TAG, e.message)
            }
        }

        function employeeItem(email, empid, name, role){
            const TAG = 'AAMP_AMP_Performance Analysis - employeeItem';
            try{
                this.email =  email;
                this.empid = empid;
                this.name = name;
                this.role = role;
            } catch (e) {
                log.debug(TAG, e.message)
            }
        }

        function getSystemNotesObject(empId, fromDate, toDate){
            return search.create({
                type: "systemnote",
                filters:
                    [
                       //["date","within","05/24/2023 2:00 pm","05/24/2023 3:00 pm"],
                        ["date","within",fromDate,toDate],
                        "AND",
                        ["name","anyof",empId]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "record",
                            sort: search.Sort.DESC,
                            label: "Record"
                        }),
                        search.createColumn({name: "name", label: "Set by"}),
                        search.createColumn({name: "date", label: "Date"}),
                        search.createColumn({name: "context", label: "Context"}),
                        search.createColumn({name: "type", label: "Type"}),
                        search.createColumn({name: "field", label: "Field"}),
                        search.createColumn({name: "oldvalue", label: "Old Value"}),
                        search.createColumn({name: "newvalue", label: "New Value"}),
                        search.createColumn({name: "role", label: "Role"})
                    ]
            });
        }

        function getSalesOrderObject(tranId){
            return  search.create({
                type: "salesorder",
                filters:
                    [
                        ["type","anyof","SalesOrd"],
                        "AND",
                        ["transactionnumbertext","haskeywords",tranId]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "Internal ID"}),
                        search.createColumn({name: "item", label: "Item"}),
                        search.createColumn({
                            name: "ordertype",
                            sort: search.Sort.ASC,
                            label: "Order Type"
                        }),
                        search.createColumn({name: "mainline", label: "*"}),
                        search.createColumn({name: "trandate", label: "Date"}),
                        search.createColumn({name: "asofdate", label: "As-Of Date"}),
                        search.createColumn({name: "postingperiod", label: "Period"}),
                        search.createColumn({name: "taxperiod", label: "Tax Period"}),
                        search.createColumn({name: "type", label: "Type"}),
                        search.createColumn({name: "tranid", label: "Document Number"}),
                        search.createColumn({name: "entity", label: "Name"}),
                        search.createColumn({name: "account", label: "Account"}),
                        search.createColumn({name: "memo", label: "Memo"}),
                        search.createColumn({name: "amount", label: "Amount"})
                    ]
            });
        }

        function getSalesOrderByTranId(tranId){
            const TAG = 'AAMP_AMP_Performance Analysis - getSalesOrderByTranId';
            let intId;
            try{
                var salesorderSearchObj = search.create({
                    type: "salesorder",
                    filters:
                        [
                            ["type","anyof","SalesOrd"],
                            "AND",
                            ["mainline","is","T"],
                            "AND",
                            ["transactionnumbertext","haskeywords",tranId]
                        ],
                    columns:
                        [
                            search.createColumn({
                                name: "ordertype",
                                sort: search.Sort.ASC,
                                label: "Order Type"
                            }),
                            search.createColumn({name: "internalid", label: "Internal ID"}),
                            search.createColumn({name: "item", label: "Item"}),
                            search.createColumn({name: "mainline", label: "*"}),
                            search.createColumn({name: "trandate", label: "Date"}),
                            search.createColumn({name: "asofdate", label: "As-Of Date"}),
                            search.createColumn({name: "postingperiod", label: "Period"}),
                            search.createColumn({name: "taxperiod", label: "Tax Period"}),
                            search.createColumn({name: "type", label: "Type"}),
                            search.createColumn({name: "tranid", label: "Document Number"}),
                            search.createColumn({name: "entity", label: "Name"}),
                            search.createColumn({name: "account", label: "Account"}),
                            search.createColumn({name: "memo", label: "Memo"}),
                            search.createColumn({name: "amount", label: "Amount"})
                        ]
                });
                var searchResultCount = salesorderSearchObj.runPaged().count;
                log.debug("salesorderSearchObj result count",searchResultCount);
                var sResult = salesorderSearchObj.run().getRange({
                    start : 0,
                    end :  1
                });
                if(sResult != null){
                    intID = sResult[0].getValue({
                        name: "internalid", label: "Internal ID"
                    });
                }
                return intId;
            } catch (e) {
                log.debug(TAG, e.message);
            }

        }

        function getEmployeeIntIdById(email){
            const TAG = 'AAMP_AMP_Performance Analysis - getEmployeeById';
            var empId = '';
            try{
                var employeeSearchObj = search.create({
                    type: "employee",
                    filters:
                        [
                            ["email","is",email]
                        ],
                    columns:
                        [
                            search.createColumn({name: "internalid", label: "Internal ID"}),
                            search.createColumn({
                                name: "entityid",
                                sort: search.Sort.ASC,
                                label: "Name"
                            }),
                            search.createColumn({name: "email", label: "Email"}),
                            search.createColumn({name: "phone", label: "Phone"}),
                            search.createColumn({name: "altphone", label: "Office Phone"}),
                            search.createColumn({name: "fax", label: "Fax"}),
                            search.createColumn({name: "supervisor", label: "Supervisor"}),
                            search.createColumn({name: "title", label: "Job Title"}),
                            search.createColumn({name: "altemail", label: "Alt. Email"})
                        ]
                });
                var searchResultCount = employeeSearchObj.runPaged().count;
                log.debug("employeeSearchObj result count",searchResultCount);
                var sResult = employeeSearchObj.run().getRange({
                    start : 0,
                    end :  1
                });
                if(sResult != null){
                    empId = sResult[0].getValue({
                        name: "internalid", label: "Internal ID"
                    });
                }
                return empId;
            } catch (e) {
                log.debug(TAG, e.message);
                return empId;
            }
        }

        function getEmployeeList(){
            const TAG = 'AAMP_AMP_Peformance Analysis - getEmployeeList';
            var employees = new Array();
            try{
                var employeeSearchObj = search.create({
                    type: "employee",
                    filters:
                        [
                        ],
                    columns:
                        [
                            search.createColumn({name: "internalid", label: "Internal ID"}),
                            search.createColumn({
                                name: "entityid",
                                sort: search.Sort.ASC,
                                label: "Name"
                            }),
                            search.createColumn({name: "email", label: "Email"}),
                            search.createColumn({name: "phone", label: "Phone"}),
                            search.createColumn({name: "altphone", label: "Office Phone"}),
                            search.createColumn({name: "fax", label: "Fax"}),
                            search.createColumn({name: "supervisor", label: "Supervisor"}),
                            search.createColumn({name: "title", label: "Job Title"}),
                            search.createColumn({name: "altemail", label: "Alt. Email"})
                        ]
                });
                var searchResultCount = employeeSearchObj.runPaged().count;
                log.debug("employeeSearchObj result count",searchResultCount);
                employeeSearchObj.run().each(function(result){

                    em_intid = result.getText({
                        name: "internalid", label: "Internal ID"
                    });
                    em_email = result.getValue({
                        name: "email", label: "Email"
                    });
                    em_name = result.getValue({
                        name: "entityid", label: "Name"
                    });
                    em_role = result.getValue({
                        name: "context", label: "Context"
                    });

                    employees.push(new employeeItem(em_email, em_intid, em_name.replace(',','-'), em_role));

                    return true;
                });
                return employees;

            } catch (e) {
                log.debug(TAG, e.message);
                return employees;
            }
        }

        function isEmpty(value) {
            var logTitle = 'isEmpty';
            try {
                if (value == null || value == '' || (!value) || value == 'undefined') {
                    return true;
                }
                return false;
            } catch (error) {
                log.error(logTitle, error);
            }
        }

        return {execute}

    });
