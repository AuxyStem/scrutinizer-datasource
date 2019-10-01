import _ from "lodash";
import { ScrutinizerJSON, Handledata } from "./reportData";
import { reportTypes, reportDirection, displayOptions } from "./reportTypes";

let makescrutJSON = new ScrutinizerJSON();
let dataHandler = new Handledata();


export class GenericDatasource {
  constructor(instanceSettings, $q, backendSrv, templateSrv) {
    this.type = instanceSettings.type;
    this.url = instanceSettings.url + "/fcgi/scrut_fcgi.fcgi";
    this.authToken = instanceSettings.jsonData["scrutinizerKey"];
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

    this.filters = "";

    this.exporterList = this.exporterList()

  }

  query(options) {


    let k = 0;
    let datatoGraph = [];


    this.runReport = false;

    var query = this.buildQueryParameters(options);

    //save the query to this, so it can be accessed by other methods.
    this.liveQuery = query;
    query.targets = query.targets.filter(t => !t.hide);

    if (query.targets[0].target === undefined) {
      return this.q.when({ data: [] });
    }

    if (this.templateSrv.getAdhocFilters) {

      query.adhocFilters = this.templateSrv.getAdhocFilters(this.name);
    } else {
      query.adhocFilters = [];
    }



    let checkStart = query.targets.length - 1;


    //check if there are ad-hoc filters added.
    if (query.adhocFilters.length > 0) {
      //save exporter export name to variable. 
      let exporter_name = query.adhocFilters[0]['key']
      let interface_name = query.adhocFilters[0]['value']

      if ((exporter_name != "Device Group") && (exporter_name != "All Exporters")) {
        let params = makescrutJSON.findExporter(this.url, this.authToken, exporter_name)
        this.doRequest(params).then((exporter_details) => {
          let exporter_ip = exporter_details.data.results[0].exporter_ip
          let params = makescrutJSON.interfaceJSON(this.url, this.authToken, exporter_ip)
          this.doRequest(params).then((response)=>{
            let data = [{ text: "All Interfaces", value: "allInterfaces" }];
            let i = 0;
            let jsonData = response.data;
  
            for (i = 0; i < jsonData.rows.length; i++) {
              data.push({
                value: jsonData.rows[i][5].filterDrag.searchStr,
                text: jsonData.rows[i][5].label
              });

              if (interface_name ===jsonData.rows[i][5].label ){
                console.log(jsonData.rows[i][5].filterDrag.searchStr)
              }
            }
  

          })
        })

      }


    }
    else {


      if (
        (query.targets[checkStart].target !== undefined || "Select Exporter") &&
        query.targets[checkStart].reportInterface !== "Select Interface" &&
        query.targets[checkStart].reportDirection !== "Select Direction" &&
        query.targets[checkStart].reportType !== "Select Report"
      ) {
        this.runReport = true;
      }


      //once all drop downs are selected, run the report.
      if (this.runReport == true) {
        return new Promise((resolve, reject) => {
          for (let j = 0; j < query.targets.length; j++) {
            //grab the parameters to from the query.
            let scrutParams = makescrutJSON.createParams(
              this.authToken,
              query.targets[j].reportType, //report type
              options["range"]["from"].unix(), //start time
              options["range"]["to"].unix(), //end time
              query.targets[j].target, //ip address
              query.targets[j].reportDirection, //report direction
              query.targets[j].reportInterface, // exporter Interface
              query.targets[j].reportFilters, // filerts
              query.targets[j].reportDisplay // bits or percent
            );
            //figure out the intervale time.
            let intervalTime = makescrutJSON.findtimeJSON(scrutParams);



            this.doRequest({
              url: `${this.url}`,
              method: "GET",
              params: intervalTime

            }).then(response => {

              //store interval here.
              let selectedInterval =
                response.data["report_object"].dataGranularity.used;
              //set up JSON to go to Scrutinizer API
              let scrutinizerJSON = makescrutJSON.reportJSON(scrutParams);



              this.doRequest({
                url: `${this.url}`,
                method: "GET",
                params: scrutinizerJSON
              }).then(response => {

                let formatedData = dataHandler.formatData(
                  response.data,
                  scrutParams,
                  selectedInterval
                );

                datatoGraph.push(formatedData);
                datatoGraph = [].concat.apply([], datatoGraph);

                k++;
                //incase user has multiple queries we want to make sure we have iterated through all of them before returning results.
                if (k === query.targets.length) {
                  return resolve({ data: datatoGraph });
                }
              });
            });
          }
        });
      }
    }
  }

  testDatasource() {
    return this.doRequest({
      url: `${this.url}`,
      method: "GET",
      params: {
        rm: "licensing",
        authToken: `${this.authToken}`
      }
    }).then(response => {
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
    let query = this.liveQuery;


    if (query.targets[0].target != undefined) {
      //determines which select you have clicked on.
      let selectedIP = scope.ctrl.target.target;

      if (selectedIP === 'deviceGroup') {
        let params = makescrutJSON.groupJSON(
          this.url,
          this.authToken
        )
        //if user selects Device Group we return a list of all groups available.
        return this.doRequest(params).then(response => {

          let i = 0

          let jsonData = response.data;
          let data = [];
          for (i = 0; i < jsonData.length; i++) {
            data.push({
              value: jsonData[i]['id'].toString(),
              text: jsonData[i]['name']
            })

          }

          return data;
        })
      } else {
        //otherwise we figre out what interfaces are available for selected device. 
        let params = makescrutJSON.interfaceJSON(
          this.url,
          this.authToken,
          selectedIP
        );

        return this.doRequest(params).then(response => {
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
    this.filters = scope.ctrl.target.filters;
    refresh.refresh();
  }
  //gets all exporters available. Will use DNS resolve by default and fail back to IP of exporter.
  getExporters(query, scope) {
    if (scope.ctrl.target.refId === "A" && query === "") {
      let params = makescrutJSON.exporterJSON(this.url, this.authToken);

      return this.doRequest(params).then(response => {
        let exporterList = [
          { text: "All Exporters", value: "allExporters" },
          { text: "Device Group", value: "deviceGroup" }];
        for (let i = 0; i < response.data.length; i++) {
          exporterList.push({
            text: response.data[i]["name"],
            value: response.data[i]["ip"]
          });
        }

        this.exporters = exporterList;
        return exporterList;
      });
    } else {
      return this.exporters;
    }
  }

  exporterList() {
    let params = makescrutJSON.exporterJSON(this.url, this.authToken);
    return this.doRequest(params).then(response => {
      let exporterList = [
        { text: "All Exporters", value: "allExporters" },
        { text: "Device Group", value: "deviceGroup" }];
      for (let i = 0; i < response.data.length; i++) {
        exporterList.push({
          text: response.data[i]["name"],
          value: response.data[i]["ip"]
        });
      }

      this.exporters = exporterList;
      return exporterList;
    })
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



  getTagKeys(options) {

    return new Promise((resolve, reject) => {
      let params = makescrutJSON.exporterJSON(this.url, this.authToken);
      this.doRequest(params).then(response => {
        let exporterList = [
          { text: "All Exporters", value: "allExporters" },
          { text: "Device Group", value: "deviceGroup" }];
        for (let i = 0; i < response.data.length; i++) {
          exporterList.push({
            text: response.data[i]["name"],
            value: response.data[i]["ip"]
          });


        }



        return resolve(exporterList)
      });

    })

  };







  getTagValues(options) {
    let selectedIP = options.key

    if (selectedIP === 'Device Group') {
      let params = makescrutJSON.groupJSON(
        this.url,
        this.authToken
      )
      //if user selects Device Group we return a list of all groups available.
      return this.doRequest(params).then(response => {

        let i = 0

        let jsonData = response.data;
        let data = [];
        for (i = 0; i < jsonData.length; i++) {
          data.push({
            value: jsonData[i]['id'].toString(),
            text: jsonData[i]['name']
          })

        }

        this.adhocFiltersInterfaces = data
        return data;
      })
    } else {
      //otherwise we figre out what interfaces are available for selected device. 
      let params = makescrutJSON.interfaceJSON(
        this.url,
        this.authToken,
        selectedIP
      );

      return this.doRequest(params).then(response => {

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