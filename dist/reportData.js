"use strict";

System.register(["lodash"], function (_export, _context) {
  "use strict";

  var _, _createClass, ScrutinizerJSON, Handledata;

  function _defineProperty(obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }

    return obj;
  }

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }],
    execute: function () {
      _createClass = function () {
        function defineProperties(target, props) {
          for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];
            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;
            if ("value" in descriptor) descriptor.writable = true;
            Object.defineProperty(target, descriptor.key, descriptor);
          }
        }

        return function (Constructor, protoProps, staticProps) {
          if (protoProps) defineProperties(Constructor.prototype, protoProps);
          if (staticProps) defineProperties(Constructor, staticProps);
          return Constructor;
        };
      }();

      _export("ScrutinizerJSON", ScrutinizerJSON = function () {
        function ScrutinizerJSON() {
          _classCallCheck(this, ScrutinizerJSON);
        }

        _createClass(ScrutinizerJSON, [{
          key: "createFilters",
          value: function createFilters(scrut, options, reportFilter, query) {
            var authToken = scrut.authToken;
            var reportType = query.reportType,
                reportDirection = query.reportDirection,
                reportDisplay = query.reportDisplay;

            var scrutDisplay = void 0;
            if (reportDisplay === "percent") {
              scrutDisplay = { display: "custom_interfacepercent" };
            } else {
              scrutDisplay = { display: "sum_octetdeltacount" };
            }
            return {
              authToken: authToken,
              reportType: reportType,
              startTime: options["range"]["from"].unix(),
              endTime: options["range"]["to"].unix(),
              reportDirection: reportDirection,
              scrutDisplay: scrutDisplay,
              scrutFilters: reportFilter

            };
          }
        }, {
          key: "createParams",
          value: function createParams(scrut, options, query) {
            var authToken = scrut.authToken;
            var reportType = query.reportType,
                reportDirection = query.reportDirection,
                reportInterface = query.reportInterface,
                target = query.target,
                reportFilters = query.reportFilters,
                reportDisplay = query.reportDisplay;

            var startTime = options["range"]["from"].unix();
            var endTime = options["range"]["to"].unix();
            var scrutFilters = void 0;
            var exporterInterface = void 0;
            var scrutDisplay = void 0;
            if (reportInterface === "allInterfaces") {
              exporterInterface = "_ALL";
            } else {
              exporterInterface = reportInterface;
            }

            //  if user wants all devices, then they are defualted to all interfaces
            if (target === "allExporters") {
              scrutFilters = {
                sdfDips_0: "in_GROUP_ALL"
              };
            } else if (target === "deviceGroup") {
              scrutFilters = {
                sdfDips_0: "in_GROUP_" + exporterInterface
              };
            } else {
              // if user wants a specific device, they can either have ALL interfaces, or a specific interface
              if (exporterInterface === "_ALL") {
                scrutFilters = {
                  sdfDips_0: "in_" + target + "_ALL"
                };
              } else {
                scrutFilters = {
                  sdfDips_0: "in_" + target + "_" + target + "-" + exporterInterface
                };
              }
            }

            if (reportFilters !== "No Filter") {
              var filterJson = JSON.parse(reportFilters);
              for (var key in filterJson) {
                if (filterJson.hasOwnProperty(key)) {
                  if (key != "sdfDips_0") {
                    scrutFilters[key] = filterJson[key];
                  }
                }
              }
            }
            if (reportDisplay === "percent") {
              scrutDisplay = { display: "custom_interfacepercent" };
            } else {
              scrutDisplay = { display: "sum_octetdeltacount" };
            }

            return {
              authToken: authToken,
              reportType: reportType,
              startTime: startTime,
              endTime: endTime,
              reportDirection: reportDirection,
              scrutFilters: scrutFilters,
              scrutDisplay: scrutDisplay

            };
          }
        }, {
          key: "createAdhocFilters",
          value: function createAdhocFilters(filterObject) {

            var reportFilters = {};

            //if there are ip addres filters, add them
            if (filterObject.sourceIp.length > 0) {
              filterObject.sourceIp.forEach(function (element, index) {
                var filerCount = "sdfIps_" + index;
                reportFilters[filerCount] = "in_" + element + "_src";
              });
            }

            if (filterObject.destIp.length > 0) {
              filterObject.destIp.forEach(function (element, index) {
                var filerCount = "sdfIps_" + index;
                reportFilters[filerCount] = "in_" + element + "_dst";
              });
            }

            if (filterObject.ports.length > 0) {
              filterObject.ports.forEach(function (element, index) {
                var filerCount = "sdfSdPorts_" + index;
                reportFilters[filerCount] = "in_" + element + "_both";
              });
            }
            //there will always be exporter filters, add them.
            filterObject.exporterDetails.forEach(function (element, index) {
              var exporterIp = element.exporterIp,
                  interfaceId = element.interfaceId;


              var filterCount = "sdfDips_" + index;
              if (exporterIp === "GROUP") {
                reportFilters[filterCount] = "in_" + exporterIp + "_" + interfaceId;
              } else if (exporterIp === "ALL") {
                reportFilters[filterCount] = "in_" + exporterIp + "_" + interfaceId;
              } else if (interfaceId != "ALL") {
                reportFilters[filterCount] = "in_" + exporterIp + "_" + exporterIp + "-" + interfaceId;
              } else if (exporterIp != "ALL" && exporterIp != "GROUP") {
                reportFilters[filterCount] = "in_" + exporterIp + "_" + interfaceId;
              }
            });

            return reportFilters;
          }
        }, {
          key: "authJson",
          value: function authJson(scrutInfo) {
            return {
              url: scrutInfo['url'],
              method: "GET",
              params: {
                rm: "licensing",
                authToken: scrutInfo['authToken']
              }
            };
          }
        }, {
          key: "exporterJSON",
          value: function exporterJSON(scrutInfo) {
            //params to figure out which exporters are available to pick from.
            return {
              url: scrutInfo['url'],
              method: "GET",
              params: {
                rm: "get_known_objects",
                type: "devices",
                authToken: scrutInfo['authToken']
              }
            };
          }
        }, {
          key: "findExporter",
          value: function findExporter(scrutInfo, exporter) {

            return {
              url: scrutInfo["url"],
              method: "GET",
              params: {
                rm: "loadMap",
                action: "search",
                str: exporter,
                authToken: scrutInfo["authToken"],
                defaultGroupOnTop: 1,
                statusTreeEnabled: 1,
                page: 1
              }
            };
          }
        }, {
          key: "findtimeJSON",
          value: function findtimeJSON(scrutInfo, scrutParams) {
            //params to figure out which interval your in based on data you are requesting
            return {
              url: scrutInfo['url'],
              method: 'get',
              params: {
                rm: "report_start",
                authToken: scrutInfo['authToken'],
                report_data: {
                  parse: true,
                  reportDirections: { selected: "" + scrutParams.reportDirection },
                  reportTypeLang: "" + scrutParams.reportType,
                  times: {
                    dateRange: "Custom",
                    start: "" + scrutParams.startTime,
                    end: "" + scrutParams.endTime,
                    clientTimezone: "America/New_York"
                  },
                  filters: scrutParams.scrutFilters,
                  dataGranularity: { selected: "auto" },
                  oneCollectorRequest: false
                }
              }

            };
          }
        }, {
          key: "groupJSON",
          value: function groupJSON(url, authToken) {
            return {
              url: url,
              method: "GET",
              params: {
                rm: "get_known_objects",
                type: "deviceGroups",
                authToken: authToken
              }
            };
          }
        }, {
          key: "interfaceJSON",
          value: function interfaceJSON(scrutInfo, ipAddress) {

            if (ipAddress['key'] === "Device Group") {
              var groupName = ipAddress['value'];
              return {
                url: scrutInfo['url'],
                method: "get",

                params: {
                  rm: "mappingConfiguration",
                  view: "mapping_configuration",
                  authToken: scrutInfo["authToken"],
                  session_state: {
                    "client_time_zone": "America/New_York", "order_by": [],
                    "search": [{
                      "column": "name",
                      "value": groupName,
                      "comparison": "equal",
                      "data": { "filterType": "string" }, "_key": "name_equal_Cisco" }],
                    "query_limit": {
                      "offset": 0, "max_num_rows": 50 }, "hostDisplayType": "dns" }
                }
              };
            } else {
              var exporterName = void 0;
              if (ipAddress['value']) {
                exporterName = ipAddress['value'];
              } else {
                exporterName = ipAddress;
              }

              return {
                url: scrutInfo["url"],
                method: "get",
                params: {
                  rm: "status",
                  action: "get",
                  view: "topInterfaces",
                  authToken: scrutInfo["authToken"],
                  session_state: {
                    client_time_zone: "America/New_York",
                    order_by: [],
                    search: [{
                      column: "exporter_search",
                      value: "" + exporterName,
                      comparison: "like",
                      data: { filterType: "multi_string" },
                      _key: "exporter_search_like_" + exporterName
                    }],
                    query_limit: { offset: 0, max_num_rows: 50 },
                    hostDisplayType: "dns"
                  }
                }
              };
            }
          }
        }, {
          key: "reportJSON",
          value: function reportJSON(scrutInfo, scrutParams) {
            //returning report params to be passed into request
            return {
              url: scrutInfo['url'],
              'method': 'get',
              params: {
                rm: "report_api",
                action: "get",
                authToken: scrutInfo['authToken'],
                rpt_json: JSON.stringify({
                  reportTypeLang: scrutParams.reportType,
                  reportDirections: {
                    selected: scrutParams.reportDirection
                  },
                  times: {
                    dateRange: "Custom",
                    start: "" + scrutParams.startTime,
                    end: "" + scrutParams.endTime
                  },
                  orderBy: scrutParams.scrutDisplay["display"],
                  filters: scrutParams.scrutFilters,
                  dataGranularity: {
                    selected: "auto"
                  }
                }),

                data_requested: _defineProperty({}, scrutParams.reportDirection, {
                  graph: "all",
                  table: {
                    query_limit: {
                      offset: 0,
                      max_num_rows: 10
                    }
                  }
                })
              }

            };
          }
        }]);

        return ScrutinizerJSON;
      }());

      _export("ScrutinizerJSON", ScrutinizerJSON);

      _export("Handledata", Handledata = function () {
        //scrutinizer returns graph data opposite of how grafana wants it. So we flip it here.
        function Handledata() {
          _classCallCheck(this, Handledata);

          this.rearrangeData = function (arr, oldIndex, newIndex) {
            while (oldIndex < 0) {
              old_index += arr.length;
            }
            while (newIndex < 0) {
              new_index += arr.length;
            }
            if (newIndex >= arr.length) {
              var k = newIndex - arr.length;

              while (k-- + 1) {
                arr.push(undefined);
              }
            }
            arr.splice(newIndex, 0, arr.splice(oldIndex, 1)[0]);
            return arr;
          };
        }

        _createClass(Handledata, [{
          key: "formatData",
          value: function formatData(scrutData, scrutParams, intervalTime) {
            var displayValue = void 0;

            if (scrutParams.scrutDisplay["display"] === "custom_interfacepercent") {
              displayValue = "percent";
            } else {
              displayValue = "bits";
            }

            var reportDirection = scrutParams.reportDirection;
            //grafana wants time in millaseconds. so we multiple by 1000.
            //we also want to return data in bits, so we device by 8
            var datatoGraph = [];
            var graphingData = scrutData;
            var i = void 0,
                j = 0;
            var graphData = graphingData["report"]["graph"]["pie"][reportDirection];
            var tableData = graphingData["report"]["graph"]["timeseries"][reportDirection];
            //if user is selecting bits, we need to multiple by 8, we also need to use the interval time.
            if (displayValue === "bits") {
              for (i = 0; i < tableData.length; i++) {
                for (j = 0; j < tableData[i].length; j++) {
                  tableData[i][j][0] = tableData[i][j][0] * 1000;
                  tableData[i][j][1] = tableData[i][j][1] * 8 / (intervalTime * 60);
                  this.rearrangeData(tableData[i][j], 0, 1);
                }
              }
            } else {
              //since interface reporting uses the total tables, we dont need to math it.
              for (i = 0; i < tableData.length; i++) {
                for (j = 0; j < tableData[i].length; j++) {
                  tableData[i][j][0] = tableData[i][j][0] * 1000;
                  tableData[i][j][1] = Math.round(tableData[i][j][1]);
                  this.rearrangeData(tableData[i][j], 0, 1);
                }
              }
            }

            for (i = 0; i < graphData.length; i++) {
              var interfaceId = void 0;
              var interfaceDesc = void 0;

              if (scrutParams["reportType"] === "interfaces") {
                if (scrutParams["reportDirection"] === "inbound") {
                  interfaceId = "Inbound Interface";
                  interfaceDesc = "Inbound";
                } else {
                  interfaceId = "Outbound Interface";
                  interfaceDesc = "Outbound";
                }
                //scrutinizer returns a small amout of "other traffic" for interface reporting
                //this has to do with the relationship between totals and conversations.
                //we don't need this data, so we toss it out. It makes it do we can use SingleStat
                //and Guage visualizations for interfaces, which is nice.
                if (graphData[i]["label"] != "Other") {
                  datatoGraph.push({
                    target: interfaceDesc + "--" + graphData[i]["tooltip"][1][interfaceId],
                    datapoints: tableData[i]
                  });
                }
              } else {
                datatoGraph.push({
                  target: graphData[i]["label"],
                  datapoints: tableData[i]
                });
              }
            }

            return datatoGraph;
          }
        }]);

        return Handledata;
      }());

      _export("Handledata", Handledata);
    }
  };
});
//# sourceMappingURL=reportData.js.map
