(function () {
    'use strict'
    angular.module('sabio.management')
        .controller('CustomerMetricsCtrl', CustomerMetricsController)

    CustomerMetricsController.$inject = ['reservationService', 'reservationStatus'];

    function CustomerMetricsController(reservationService, reservationStatus) {
        let vm = this;
        init();

        function init() {
            vm.lineChartOptions = {
                chart: {
                    type: 'lineChart',
                    height: 400,
                    width: 725,
                    margin: {
                        top: 70,
                        right: 13,
                        bottom: 70,
                        left: 80
                    },
                    x: function (d) { return d[0]; },
                    y: function (d) { return d[1]; },

                    color: ['#C4A981', '#2b3a42'],
                    duration: 300,
                    useInteractiveGuideline: true,
                    clipVoronoi: false,

                    xAxis: {
                        axisLabel: 'Days',
                        tickFormat: function (d) {
                            return d3.time.format('%m/%d/%Y')(new Date(d))
                        },
                        rotateLabels: -35,
                        staggerLabels: true,
                        reduceXTicks: false,
                        scaleExtent: [1, 10]
                    },

                    yAxis: {
                        axisLabel: 'Reservations',
                        tickFormat: function (d) {
                            return d3.format('')(d);
                        },
                        axisLabelDistance: 5
                    }
                }
            };
            vm.pieChartOptions = {
                chart: {
                    type: 'pieChart',
                    height: 400,
                    width: 400,
                    x: function (d) { return d.key; },
                    y: function (d) { return d.y; },
                    color: ['#C4A981', '#2b3a42'],
                    showLabels: true,
                    duration: 500,
                    labelThreshold: 0.01,
                    labelSunbeamLayout: true,
                    legend: {
                        margin: {
                            top: 5,
                            right: 0,
                            bottom: 5,
                            left: 0
                        }
                    }
                }
            };


            //metrics header init function
            vm.getCustomerBaseMetrics;

            //daterangepicker function
            vm.getReservations = getReservations;


            // onLoad init functions
            let dtOne = moment().toISOString();
            vm.dtEnd = dtOne;

            let dtTwo = moment();
            vm.dtStart = dtTwo.subtract(7, 'days').toISOString();

            vm.startDate = new Date;
            vm.startDate.setSeconds(0);
            vm.startDate.setHours(0);
            vm.startDate.setMinutes(0);

            getReservationsWithinDtRange(vm.dtStart, vm.dtEnd);
            getTodaysCustomerBaseMetrics(vm.startDate, new Date);
            getAllCustomerBaseMetrics();

            //chart init functions
            vm.lineChartData;
            vm.pieChartData;
            vm.api;

            //calendar ng-model
            vm.date = {};
            vm.date = {
                startDate: moment().subtract(6, 'days'),
                endDate: moment()
            }
        }

        // datepicker function
        function getReservations() {
            debugger;
            if (vm.date.startDate == null && vm.date.endDate == null) {
                vm.dtStart2 = null
                vm.dtEnd2 = null
            } else {
                vm.dtStart2 = vm.date.startDate.toDate();

                vm.dtEnd2 = vm.date.endDate.toDate();
            }
            getReservationsWithinDtRange(vm.dtStart2, vm.dtEnd2);
        }

        //metrics header functions
        function getTodaysCustomerBaseMetrics(dtStart, dtEnd) {
            reservationService.getTodaysCustomerBaseMetrics(dtStart, dtEnd)
                .then((data) => {
                    vm.todaysCustomers = data.items.length;
                    console.log(vm.todaysCustomers);
                })
        }

        function getAllCustomerBaseMetrics() {
            reservationService.getAllCustomerBaseMetrics()
                .then((data) => {
                    vm.totalCustomers = data.items;
                    console.log(vm.totalCustomers);
                })
        }

        //event handler for dtrangepicker when dates are chosen
        function getReservationsWithinDtRange(dtStart, dtEnd) {
            reservationService.getReservationsForLineChart(dtStart, dtEnd)
                .then((data) => {
                    debugger;
                    vm.lineChartData = data.items;
                    vm.api.refresh();
                })
                .catch((error) => {
                    console.log(error)
                })
            reservationService.getReservationsForPieChart(dtStart, dtEnd)
                .then((data) => {
                    debugger;
                    vm.pieChartData = data.items;
                    vm.api.refresh();
                })
                .catch((error) => {
                    console.log(error)
                })
        }
    }

})()