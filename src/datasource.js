import _ from "lodash";
import { ScrutinizerJSON, Handledata } from "./reportData";
import {
  reportTypes,
  reportDirection,
  displayOptions,
  filterTypes
} from "./reportTypes";

let makescrutJSON = new ScrutinizerJSON();
let dataHandler = new Handledata();

export class GenericDatasource {
  constructor(instanceSettings, $q, backendSrv, templateSrv) {
    this.type = instanceSettings.type;
    this.name = instanceSettings.name;
    this.q = $q;
    this.backendSrv = backendSrv;
    this.templateSrv = templateSrv;
    this.reportOptions = reportTypes;
    this.reportDirections = reportDirection;
    this.displayOptions = displayOptions;
    this.withCredentials = instanceSettings.withCredentials;
    this.liveQuery = "";
    this.headers = { "Content-Type": "application/json" };
    if (
      typeof instanceSettings.basicAuth === "string" &&
      instanceSettings.basicAuth.length > 0
    ) {
      this.headers["Authorization"] = instanceSettings.basicAuth;
    }
    this.runReport = false;

    this.exporters = [];
    this.filterTypes = filterTypes;

    this.filters = "";

    this.scrutInfo = {
      url: instanceSettings.url + "/fcgi/scrut_fcgi.fcgi",
      authToken: instanceSettings.jsonData["scrutinizerKey"]
    };
    this.exporterList = this.exporterList();
  }

  query(options) {
    //store number of queries being run, make sure to run a Scrutinizer request for each query made.
    let numberOfQueries = 0;
    //data sent up into this list, it's returned at end.
    let datatoGraph = [];
    //only run a report if all options are populated, only matter when there are not adhoc filters.
    this.runReport = false;
    //takes the query and stores it to a variable
    var query = this.buildQueryParameters(options);
    //save the query to this, so it can be accessed by other methods.
    this.liveQuery = query;
    query.targets = query.targets.filter(t => !t.hide);
    if (query.targets.length <= 0) {
      return this.q.when({ data: [] });
    }
    //add adhoc filters to the query.
    if (this.templateSrv.getAdhocFilters) {
      query.adhocFilters = this.templateSrv.getAdhocFilters(this.name);
    } else {
      query.adhocFilters = [];
    }

    let checkStart = query.targets.length - 1;
    //counter is used to keep track of number of exporters. This matters for creating the filter ojects
    let filterTypes = this.filterTypes.map(filter => filter["text"]);
    let filterObject = {
      sourceIp: [],
      exporterDetails: [],
      exporters: [],
      ports: [],
      destIp: []
    };
    if (query.adhocFilters.length > 0) {
      query.adhocFilters.forEach(filter => {
        if (!filterTypes.includes(filter["key"])) {
          filterObject.exporters.push(filter["key"]);
        } else {
          this.filterTypes.forEach(filterType => {
            if (filterType["text"] === filter["key"]) {
              let filterKey = filterType["value"];
              let filterValue = filter["value"];
              filterObject[filterKey].push(filterValue);
            }
          });
        }
      });
    }
    return new Promise((resolve, reject) => {
      //this exporter count is compared to the number of exporters to verify we have loops threw everything before returning.
      let exporterCount = 0;
      let numberofExporters = 0;

      if (query.adhocFilters.length > 0) {
        query.adhocFilters.forEach(filter => {
          //if there is an exporter passed in the adhoc filter.
          if (
            filterObject.exporters.length > 0 &&
            !filterTypes.includes(filter["key"])
          ) {
           
           
            numberofExporters++;

            //in some cases we will be passed the DNS/SNMP name of an exporter, here we convert it to an IP address needed for final filter.
            
            let adhocParams = makescrutJSON.findExporter(
              this.scrutInfo,
              filter["key"]
            );

            this.doRequest(adhocParams).then(exporter_details => {
         
              let exporterIpFound
              if (exporter_details.data.results.length >0){
                exporterIpFound = exporter_details.data.results[0].exporter_ip;
              } else if (filter['key'] === "All Exporters"){
                exporterIpFound = "GROUP"
              }else if (filter['key'] === "Device Group") {
                exporterIpFound = filter
              }
             

              //need to find the interface ID for the interface passed to Scrutinizer.
              let interfaceParams = makescrutJSON.interfaceJSON(
                this.scrutInfo,
                exporterIpFound
              );

              this.doRequest(interfaceParams).then(interfaceDetails => {
                let interfaceList = interfaceDetails["data"]["rows"];

                //for each interface that belongs to a device, we want to compare it against the one selected in grafana. If it matched we can add it to the filters
        
                 if (filter["value"] === "All Interfaces") {
                  filterObject.exporterDetails.push({
                    exporterName: filter["key"],
                    exporterIp: exporterIpFound,
                    interfaceName: filter["value"],
                    interfaceId: "ALL"
                  });
                } else if(filter["key"] === "Device Group"){
                  filterObject.exporterDetails.push({
                    exporterName: filter["key"],
                    exporterIp: "GROUP",
                    interfaceName: filter["value"],
                    interfaceId: interfaceList[0][8]['id'].toString()
                  })
                }
                else{
                  interfaceList.forEach(exporterInterface => {
                    let interfaceID = exporterInterface[5].filterDrag.searchStr;
                    let interfaceName = exporterInterface[5]["label"];

                    //if selected interface matches and interface in the list, add it to object
                    if (filter["value"] === interfaceName) {
                      filterObject.exporterDetails.push({
                        exporterName: filter["key"],
                        exporterIp: exporterIpFound,
                        interfaceName: filter["value"],
                        interfaceId: interfaceID
                      });
                    }
                  });
                }

                exporterCount++;
                //we have now looped through all the exporters in the filters.
                if (exporterCount === numberofExporters) {
                 
                  //created the filters we need to pass into each gadget on the dashboard.
                  let reportFilter = makescrutJSON.createAdhocFilters(
                    filterObject
                  );
   
                  //run a query for each gadget on the dashboard.
                  query.targets.forEach(eachQuery => {
                    let scrutParams = makescrutJSON.createFilters(
                      this.scrutInfo,
                      options,
                      reportFilter,
                      eachQuery
                    );

                    let params = makescrutJSON.findtimeJSON(
                      this.scrutInfo,
                      scrutParams
                    );
                    //find out what interval the data is in, we need to use this later to normalize the graphs.
                    this.doRequest(params).then(response => {
                      let selectedInterval =
                        response.data["report_object"].dataGranularity.used;
                      //set up JSON to go to Scrutinizer API
                      let params = makescrutJSON.reportJSON(
                        this.scrutInfo,
                        scrutParams
                      );
                      //request for report data made to scrutinizer
                      this.doRequest(params).then(response => {
                        //data organized into how Grafana expects it.
                        let formatedData = dataHandler.formatData(
                          response.data,
                          scrutParams,
                          selectedInterval
                        );

                        datatoGraph.push(formatedData);
                        datatoGraph = [].concat.apply([], datatoGraph);
                        numberOfQueries++;
                        //make sure we have gone through each query in a gadget.
                        if (numberOfQueries === query.targets.length) {
                          return resolve({ data: datatoGraph });
                        }
                      });
                    });
                  });
                }
              });
            });
          }
          //if there is not an exporter passed in t e filter.
          else if (filterObject.exporters.length === 0) {
            query.targets.forEach((query, index, array) => {
              let scrutParams = makescrutJSON.createParams(
                this.scrutInfo,
                options,
                query
              );
              //figure out the intervale time.
              let params = makescrutJSON.findtimeJSON(
                this.scrutInfo,
                scrutParams
              );
              this.doRequest(params).then(response => {
                //store interval here.
                let selectedInterval =
                  response.data["report_object"].dataGranularity.used;
                //set up JSON to go to Scrutinizer API
                this.filters = makescrutJSON.createAdhocFilters(filterObject);
                //add adhoc filters to exhisting filters.
                let merged = {
                  ...this.filters,
                  ...scrutParams["scrutFilters"]
                };

                scrutParams.scrutFilters = merged;
                let params = makescrutJSON.reportJSON(
                  this.scrutInfo,
                  scrutParams
                );
                this.doRequest(params).then(response => {
                  let formatedData = dataHandler.formatData(
                    response.data,
                    scrutParams,
                    selectedInterval
                  );

                  datatoGraph.push(formatedData);
                  datatoGraph = [].concat.apply([], datatoGraph);

                  numberOfQueries++;
                  //incase user has multiple queries we want to make sure we have iterated through all of them before returning results.
                  if (numberOfQueries === array.length) {
                    return resolve({ data: datatoGraph });
                  }
                });
              });
            });
          }
        });
      } else {
        //else block meands you don't have any adhoc filters applied.
        if (
          (query.targets[checkStart].target !== undefined ||
            "Select Exporter") &&
          query.targets[checkStart].reportInterface !== "Select Interface" &&
          query.targets[checkStart].reportDirection !== "Select Direction" &&
          query.targets[checkStart].reportType !== "Select Report"
        ) {
          this.runReport = true;
        }

        //once all drop downs are selected, run the report.
        if (this.runReport == true) {
          
          query.targets.forEach((query, index, array) => {
            let scrutParams = makescrutJSON.createParams(
              this.scrutInfo,
              options,
              query
            );
            //figure out the intervale time.
            let params = makescrutJSON.findtimeJSON(
              this.scrutInfo,
              scrutParams
            );
            this.doRequest(params).then(response => {
              //store interval here.
              let selectedInterval =
                response.data["report_object"].dataGranularity.used;
              //set up JSON to go to Scrutinizer API
              let params = makescrutJSON.reportJSON(
                this.scrutInfo,
                scrutParams
              );
              this.doRequest(params).then(response => {
                let formatedData = dataHandler.formatData(
                  response.data,
                  scrutParams,
                  selectedInterval
                );

                datatoGraph.push(formatedData);
                datatoGraph = [].concat.apply([], datatoGraph);

                numberOfQueries++;
                //incase user has multiple queries we want to make sure we have iterated through all of them before returning results.
                if (numberOfQueries === array.length) {
                  return resolve({ data: datatoGraph });
                }
              });
            });
          });
        }
      }
    });
  }

  testDatasource() {
    console.log("Running Test");
    let params = makescrutJSON.authJson(this.scrutInfo);

    return this.doRequest(params).then(response => {
      if (response.status === 200) {
        if (response.data.details == "invalidToken") {
          //alert if authToken is expired or invalid
          return {
            status: "failed",
            message: `Check your API key, recevied back: ${response.data.err}`,
            title: "Api Key Failure"
          };
        } else {
          //success if everything works.
          return {
            status: "success",
            message: "Data source is working",
            title: "Success"
          };
        }
      }
    });
  }

  findInterfaces(options, scope) {
    console.log("running find interfaces");
    let query = this.liveQuery;

    if (query.targets) {
      //determines which select you have clicked on.
      let selectedIP = scope.ctrl.target.target;

      if (selectedIP === "deviceGroup") {
        let params = makescrutJSON.groupJSON(
          this.scrutInfo["url"],
          this.scrutInfo["authToken"]
        );
        
        //if user selects Device Group we return a list of all groups available.
        return this.doRequest(params).then(response => {
          let i = 0;

          let jsonData = response.data;
          let data = [];
          for (i = 0; i < jsonData.length; i++) {
            data.push({
              value: jsonData[i]["id"].toString(),
              text: jsonData[i]["name"]
            });
          }

          return data;
        });
      } else {
        //otherwise we figre out what interfaces are available for selected device.
        let interfaceThings = makescrutJSON.interfaceJSON(
          this.scrutInfo,
          selectedIP
        );

        return this.doRequest(interfaceThings).then(response => {
          let data = [{ text: "All Interfaces", value: "allInterfaces" }];
          let i = 0;
          let jsonData = response.data;

          for (i = 0; i < jsonData.rows.length; i++) {
            data.push({
              value: jsonData.rows[i][5].filterDrag.searchStr,
              text: jsonData.rows[i][5].label
            });
          }

          return data;
        });
      }
    }
  }

  applyFilter(scope, refresh) {
    console.log("running apply filters");
    this.filters = scope.ctrl.target.filters;
    refresh.refresh();
  }

  //gets all exporters available. Will use DNS resolve by default and fail back to IP of exporter.
  getExporters() {
    console.log("running get exporters");
    return this.exporters;
  }

  exporterList() {
    let params = makescrutJSON.exporterJSON(this.scrutInfo);
    return this.doRequest(params).then(response => {
      let exporterList = [
        { text: "All Exporters", value: "allExporters" },
        { text: "Device Group", value: "deviceGroup" }
      ];
      for (let i = 0; i < response.data.length; i++) {
        exporterList.push({
          text: response.data[i]["name"],
          value: response.data[i]["ip"]
        });
      }

      this.exporters = exporterList;
      return exporterList;
    });
  }

  doRequest(options) {
    options.withCredentials = this.withCredentials;
    options.headers = this.headers;

    return this.backendSrv.datasourceRequest(options);
  }

  //function from simplejsondatasource, used to take values from drop downs and add to query.
  //When adding a new dropdown you need to update this function.
  buildQueryParameters(options) {
    options.targets = _.filter(options.targets, target => {
      return target.target !== "select metric";
    });

    var targets = _.map(options.targets, target => {
      return {
        target: this.templateSrv.replace(
          target.target,
          options.scopedVars,
          "regex"
        ),
        refId: target.refId,
        hide: target.hide,
        type: target.type || "timeserie",

        reportType: this.templateSrv.replace(
          target.report,
          options.scopedVars,
          "regex"
        ),

        reportDirection: this.templateSrv.replace(
          target.direction,
          options.scopedVars,
          "regex"
        ),

        reportInterface: this.templateSrv.replace(
          target.interface || "Select Interface",
          options.scopedVars,
          "regex"
        ),

        reportFilters: this.templateSrv.replace(
          target.filters || "No Filter",
          options.scopedVars,
          "regex"
        ),

        reportDisplay: this.templateSrv.replace(
          target.display || "No Display",
          options.scopedVars,
          "regex"
        )
      };
    });

    options.targets = targets;

    return options;
  }

  //used to figure out which interfaces to show for a paritcular exporter.
  HandleAdhocFilters(resolve, options) {
    if (options.key !="Device Group"){
      let exporterParams = makescrutJSON.findExporter(
        this.scrutInfo,
        options.key
      );
      let interfaces = [{ text: "All Interfaces" }];

      this.doRequest(exporterParams).then(exporterResults => {
        let exporterIp = exporterResults["data"]["results"][0]["exporter_ip"];
        let interfaceParams = makescrutJSON.interfaceJSON(
          this.scrutInfo,
          exporterIp
        );

        this.doRequest(interfaceParams).then(interfaceDetails => {
          let interfaceList = interfaceDetails["data"]["rows"];

          for (let k = 0; k < interfaceList.length; k++) {
            let interfaceName = interfaceList[k][5]["label"];
            interfaces.push({
              text: interfaceName
            });
          }
          return resolve(interfaces);
        });
      });
    
    }
    else {
      let params = makescrutJSON.groupJSON(
        this.scrutInfo['url'],
        this.scrutInfo["authToken"]
      );

     //if user selects Device Group we return a list of all groups available.
      this.doRequest(params).then(response => {
        let i = 0;

        let jsonData = response.data;
        let data = [];
        for (i = 0; i < jsonData.length; i++) {
          data.push({
            value: jsonData[i]["id"].toString(),
            text: jsonData[i]["name"]
          });
        }

        return resolve(data);
    })}
    
  }

  addInterfaces(exporterName) {
    //if key is exporter there is no AND, we know we are looking for interfaces on that exporter.
    let interfaces = [];
    let exporterToSearch = exporterName;
    let adhocParams = makescrutJSON.findExporter(
      this.scrutInfo,
      exporterToSearch
    );
    this.doRequest(adhocParams).then(exporter_details => {
      let exporterIpFound = exporter_details.data.results[0].exporter_ip;
      let interfacesToSearch = makescrutJSON.interfaceJSON(
        this.scrutInfo,
        exporterIpFound
      );
      this.doRequest(interfacesToSearch).then(interfaceDetails => {
        let i = 0;
        let interfaceJson = interfaceDetails.data;

        if (interfaces.length > 0) {
          interfaces = [];
        }
        for (i = 0; i < interfaceJson.rows.length; i++) {
          //add interfaces to the interface filter options
          interfaces.push(interfaceJson.rows[i][5].label);
        }

        return resolve(interfaces);
      });
    });
  }
  presentOptions(resolve) {
    let params = makescrutJSON.exporterJSON(this.scrutInfo);
    return this.doRequest(params).then(response => {
      let exporterList = [
        { text: "All Exporters" },
        { text: "Device Group" },
        { text: "Source IP Filter" },
        { text: "Add Port Filter" },
        { text: "Destination IP Filter" }
      ];
      for (let i = 0; i < response.data.length; i++) {
        exporterList.push({
          text: response.data[i]["name"],
          value: response.data[i]["ip"]
        });
      }

      this.exporters = exporterList;
      return resolve(exporterList);
    });
  }

  getTagKeys(options) {
    return new Promise((resolve, reject) => {
      this.presentOptions(resolve);
    });
  }

  getTagValues(options) {
    console.log("getting tag values");
  
    switch (options.key) {
      case "Source IP Filter":
        return new Promise((resolve, reject) => {
          resolve();
        });
      case "Destination IP Filter":
            return new Promise((resolve, reject) => {
              resolve();
            });
      case "Add Port Filter":
            return new Promise((resolve, reject) => {
              resolve();
            });
      case "All Exporters":
          return new Promise((resolve, reject) => {
            resolve([{'text':'All Interfaces',
                      'value':'All Interfaces'}]);
          });
      default:
        return new Promise((resolve, reject) => {
          this.HandleAdhocFilters(resolve, options);
        });
    }
  }
}
