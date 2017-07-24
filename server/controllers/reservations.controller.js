const moment = require('moment');
const responses = require('../models/responses');
const path = require('path');
const apiPrefix = '/api/reservations';
const keySecret = process.env.SECRET_KEY;
const stripe = require('stripe')(keySecret);
const reservationModel = require('../models/reservation');
const searchesModel = require('../models/searches')
const reservationsService = require('../services/reservations.service')({
    modelService: reservationModel
});
const searchesService = require('../services/searches.service')({
    modelService: searchesModel
})
const usersHelper = require('../helpers/usersHelper')();

module.exports = reservationsController;

function reservationsController() {
    return {
        getReservationByIdExt: getReservationByIdExt,
        getAll: getAll,
        getOneById: getOneById,
        insert: insert,
        chargeAndCreateReservation: chargeAndCreateReservation,
        sendReceipt: sendReceipt,
        updateById: updateById,
        removeById: removeById,
        getAllReservationStatuses: getAllReservationStatuses,
        search: search,
        getReservationsByDate: getReservationsByDate,
        getReservationMetrics: getReservationMetrics,
        getTodaysCustomerBaseMetrics: getTodaysCustomerBaseMetrics,
        getAllCustomerBaseMetrics: getAllCustomerBaseMetrics,
        getReservationsForLineChart: getReservationsForLineChart,
        getReservationsForPieChart: getReservationsForPieChart,
        // getVehiclesUsageTime: getVehiclesUsageTime,
        getTopVehicleData: getTopVehicleData,
        getCurrentMonthReservationProfitAndVehicleUsageTime: getCurrentMonthReservationProfitAndVehicleUsageTime,
        getVehiclesDateRangeUsageTime: getVehiclesDateRangeUsageTime,
        getMostUsedVehicles: getMostUsedVehicles,
        checkOutVehicle: checkOutVehicle,
        getCurrentReservations: getCurrentReservations,
        getReservationsByVehicleIdDate: getReservationsByVehicleIdDate,
        checkInVehicle: checkInVehicle,
        getLastMonthReservations: getLastMonthReservations,
        getYearVehiclesUsageTime: getYearVehiclesUsageTime,
        getTotalVehicleUsageTime: getTotalVehicleUsageTime,
        createPendingReservation: createPendingReservation,
        updateReservationStatus: updateReservationStatus,
        searchReservationsGuests: searchReservationsGuests,
        insertNewSearch: insertNewSearch,
        recentMongoSearches: recentMongoSearches
    }

    function search(req, res) {
        let params = req.query;
        let queryCondition = {
            agency: usersHelper.getAgencyId(req, res)
        };

        reservationsService.search(params, queryCondition)
            .then((reservations) => {
                const responseModel = new responses.ItemsResponse()
                responseModel.items = reservations
                res.json(responseModel)
            })
            .catch((err) => {
                return res.status(500).send(new responses.ErrorResponse(err))
            })
    }


    function getReservationByIdExt(req, res) {
        let queryCondition = {
            agency: usersHelper.getAgencyId(req, res)
        };
        reservationsService.gettingReservationByIdExt(queryCondition)
            .then((reservation) => {
                const responseModel = new responses.ItemResponse();
                responseModel.item = reservation;
                res.json(responseModel);
            })
            .catch((err) => {
                return res.status(500).send(new responses.ErrorResponse(err));
            });
    }

    function getAll(req, res) {
        let queryCondition = {
            agency: usersHelper.getAgencyId(req, res)
        };
        reservationsService.getAll(queryCondition)
            .then((reservations) => {
                const responseModel = new responses.ItemsResponse();
                responseModel.items = reservations;
                res.json(responseModel);
            }).catch((err) => {
                res.status(500).send(new responses.ErrorResponse(err));
            });
    }

    function getOneById(req, res) {
        let queryCondition = {
            _id: req.params.id
        };
        reservationsService.getOne(queryCondition)
            .then((reservation) => {
                const responseModel = new responses.ItemResponse();
                responseModel.item = reservation;
                res.json(responseModel);
            })
            .catch((err) => {
                return res.status(500).send(new responses.ErrorResponse(err));
            });
    }

    function insert(req, res) {
        let document = req.body;
        document.agency = usersHelper.getAgencyId(req, res);
        reservationsService.insert(document)
            .then((reservation) => {
                const responseModel = new responses.ItemResponse();
                responseModel.item = reservation;
                res.status(201)
                    .location(path.join(apiPrefix, reservation._id.toString()))
                    .json(responseModel);
            })
            .catch((err) => {
                return res.status(500).send(new responses.ErrorResponse(err));
            });
    }

    function chargeAndCreateReservation(req, res) {
        const stripeToken = req.body.stripeToken;
        let reservationInfo = req.body.reservationInfo;
        const reservationFee = req.body.reservationFee;
        const guestName = `${reservationInfo.reservationGuests[0].firstName} ${reservationInfo.reservationGuests[0].lastName}`;
        const guestEmail = reservationInfo.reservationGuests[0].email;

        const charge = stripe.charges.create({
            amount: reservationFee * 100,
            currency: "usd",
            description: `Reservation Fee – ${guestName}`,
            metadata: {
                "Guest Name": `${guestName}`,
                "Phone Number": reservationInfo.reservationGuests[0].phone,
                "Email": guestEmail
            },
            source: stripeToken.id
        })
            .then((charge) => {
                reservationInfo.stripeTransaction = {
                    chargeId: charge.id,
                    amountPaid: reservationFee
                };
                const document = reservationInfo;
                reservationsService.insert(document)
                    .then((reservation) => {
                        let responseModel = new responses.ItemsResponse();
                        responseModel.items = [charge, reservation];
                        return res.json(responseModel);
                    })
                    .catch((err) => {
                        return res.status(500).send(new responses.ErrorResponse([`Payment processed but reservation info was not able to be saved. ${err._message}.`, charge]));
                    });
            })
            .catch((err) => {
                return res.status(500).send(new responses.ErrorResponse(`Payment could not be completed. ${err}.`));
            });
    }

    function sendReceipt(req, res) {
        const chargeId = req.body.chargeId;
        const customerEmail = req.body.customerEmail;

        stripe.charges.update(chargeId, {
            receipt_email: customerEmail
        })
            .then((response) => {
                let responseModel = new responses.ItemResponse();
                responseModel.item = response;
                return res.json(responseModel);
            })
            .catch((err) => {
                return res.status(500).send(new responses.ErrorResponse(`Error updating receipt email: ${err}`));
            });
    }

    function updateById(req, res) {
        let queryCondition = {
            _id: req.params.id
        };
        reservationsService.updateOne(queryCondition, req.body)
            .then((reservation) => {
                const responseModel = new responses.ItemResponse()
                res.status(201)
                    .json(responseModel)
            })
            .catch((err) => {
                return res.status(500).send(new responses.ErrorResponse(err.stack));
            });
    }

    function checkOutVehicle(req, res) {
        let queryCondition = {
            _id: req.params.id
        };
        reservationsService.checkOutVehicle(queryCondition, req.body)
            .then((reservation) => {
                const responseModel = new responses.ItemResponse()
                res.status(201)
                    .json(responseModel)
            })
            .catch((err) => {
                return res.status(500).send(new responses.ErrorResponse(err.stack));
            });
    }

    function removeById(req, res) {
        let queryCondition = {
            _id: req.params.id
        };
        reservationsService.removeOne(queryCondition)
            .then((reservation) => {
                const responseModel = new responses.ItemResponse();
                responseModel.item = reservation;
                res.json(responseModel);
            })
            .catch((err) => {
                return res.status(500).send(new responses.ErrorResponse(err));
            });
    }

    function getReservationsByDate(req, res) {
        var dayStart = new Date(req.params.date);
        dayStart.setSeconds(0);
        dayStart.setHours(0);
        dayStart.setMinutes(0);

        var dayEnd = new Date(dayStart);
        dayEnd.setHours(23);
        dayEnd.setMinutes(59);
        dayEnd.setSeconds(59);

        let queryCondition = {
            reservationDate: { $lt: dayEnd, $gte: dayStart },
            agency: usersHelper.getAgencyId(req, res)
        }

        reservationsService.getReservationsByDate(queryCondition)
            .then((reservation) => {
                const responseModel = new responses.ItemsResponse()
                responseModel.items = reservation
                res.json(responseModel)
            })
            .catch((err) => {
                return res.status(500).send(new responses.ErrorResponse(err));
            });

    }


    function getReservationsByVehicleIdDate(req, res) {
        let dayInput = new Date(req.params.date);
        let day = moment(dayInput.toISOString());
        let dayBegin = moment(day.startOf('day'));
        let dayEnd = moment(day.endOf('day'));


        let queryCondition = {
            vehicle: req.params.id,
            reservationDate: {
                $gte: dayBegin.format(),
                $lte: dayEnd.format()
            }
        };

        reservationsService.getReservationsByVehicleIdDate(queryCondition)
            .then((reservations) => {
                const responseModel = new responses.ItemsResponse();
                responseModel.items = reservations;
                res.json(responseModel);
            })
            .catch((err) => {
                return res.status(500)
                    .send(new responses.ErrorResponse(err));
            });
    }

    function getAllReservationStatuses(req, res) {
        reservationsService.getAllReservationStatuses()
            .exec((err, reservation) => {
                const responseModel = new responses.ItemsResponse();
                responseModel.items = reservation;
                res.json(responseModel);
            }).catch((err) => {
                res.status(500).send(new responses.ErrorResponse(err));
            });

    }

    function getReservationMetrics(req, res) {
        reservationsService.getReservationMetrics(req, res)
            .then((reservations) => {
                const responseModel = new responses.ItemsResponse();
                responseModel.items = reservations;
                res.json(responseModel);
            })
            .catch((err) => {
                return res.status(500)
                    .send(new responses.ErrorResponse(err));
            });
    }

    function getTodaysCustomerBaseMetrics(req, res) {
        reservationsService.getTodaysCustomerBaseMetrics(req.query, req.user)
            .then((reservations) => {
                const responseModel = new responses.ItemsResponse();
                responseModel.items = reservations;
                res.json(responseModel);
            })
            .catch((err) => {
                return res.status(500)
                    .send(new responses.ErrorResponse(err));
            });
    }

    function getTopVehicleData(req, res) {
        reservationsService.getTopVehicleData(req, res)
            .then((reservations) => {
                const responseModel = new responses.ItemsResponse();
                responseModel.items = reservations;
                res.json(responseModel);
            })
            .catch((err) => {
                return res.status(500)
                    .send(new responses.ErrorResponse(err));
            });
    }

    function getAllCustomerBaseMetrics(req, res) {
        let params = {
            query: req.query,
            reservationStatus: 'Finalized'
        };
        let queryCondition = {
            agency: req.user.agency
        }
        reservationsService.getAllCustomerBaseMetrics(params, queryCondition)
            .then((reservations) => {
                const responseModel = new responses.ItemsResponse();
                responseModel.items = reservations;
                res.json(responseModel);
            })
            .catch((err) => {
                return res.status(500)
                    .send(new responses.ErrorResponse(err));
            });
    }

    function getReservationsForLineChart(req, res) {
        debugger;
        let params = {
            query: req.query,
            reservationStatus: 'Finalized',
            source: 'Helm'
        };
        let queryCondition = {
            agency: req.user.agency._id
        }

        reservationsService.getReservationsForLineChart(params, queryCondition)
            .then((reservations) => {
                debugger;
                // created an object for each variable
                // with two properties (key, values) 
                // values has an empty array, for the line chart.
                let helm = { key: 'Helm', values: [] };
                let knot = { key: 'Knot', values: [] };
                let oneDay = 86400000;
                let dtStart = new Date(params.query.dtStart).getTime();
                let dtEnd = new Date(params.query.dtEnd).getTime();
                let date = new Date();
                date.setTime(1270544790922);
                // let pacificOffset = 7 * 60 * 60000;//maybe 3 [h*60*60000 = ms]
                let userOffset = date.getTimezoneOffset() * 60000; // [min*60000 = ms]


                reservations.forEach((reservation) => {
                    // this for each loop, goes through the array and 
                    // takes whatever is in the position of values in my variables above
                    // and pushes them to the property of values (empty array) inside of the specified object 
                    knot.values.push([new Date(reservation.date).getTime() + userOffset, reservation.Consumer])
                    helm.values.push([new Date(reservation.date).getTime() + userOffset, reservation.Helm])
                });
                // here is where the values of the knot and helm variables are put into an array
                // let items = getLineChartData(reservations, new Date(params.query.dtStart), new Date(params.query.dtEnd));
                // var helmArray = [], knotArray = [];
                // for(var i = 0; i < helm.values.length; i++) {
                //     helmArray.push([new Date(helm.values[i][0]), helm.values[i][1]]);
                //     knotArray.push([new Date(knot.values[i][0]), knot.values[i][1]])
                // }
                // var h = helmArray, k = knotArray;

                let items = [helm, knot]
                const responseModel = new responses.ItemsResponse();
                responseModel.items = items;
                res.json(responseModel);
            })
            .catch((err) => {
                return res.status(500).send(new responses.ErrorResponse(err));
            })
    }

    function getReservationsForPieChart(req, res) {
        debugger;
        let params = {
            query: req.query,
            reservationStatus: 'Finalized',
            source: 'Helm'
        };
        let queryCondition = {
            agency: req.user.agency
        }

        reservationsService.getReservationsForPieChart(params, queryCondition)
            .then((reservations) => {
                debugger;
                // created an object for each variable
                // with two properties (key, values)
                // values has an empty array, for the line chart.
                let pieHelm = [{ key: 'Helm', y: reservations.Helm }];
                let pieKnot = [{ key: 'Knot', y: reservations.Consumer }];
                let helmTotal = 0;
                let knotTotal = 0;

                reservations.forEach((reservations) => {
                    // this for each loop, goes through the array and
                    // takes whatever is in the position of values in my variables above
                    // and pushes them to the property of values (empty array) inside of the specified object
                    pieHelm.push([reservations.Helm])
                    helmTotal += reservations.Helm
                    pieKnot.push([reservations.Consumer])
                    knotTotal += reservations.Consumer
                    pieKnot.y = reservations.Consumer;
                    pieHelm.y = reservations.Helm;
                });
                // here is where the values of the knot and helm variables are put into an array
                let items = [{ key: 'Helm', y: helmTotal }, { key: 'Knot', y: knotTotal }]
                const responseModel = new responses.ItemsResponse();
                responseModel.items = items; 
                res.json(responseModel);
            })
            .catch((err) => {
                return res.status(500).send(new responses.ErrorResponse(err));
            })
    }

    function getCurrentReservations(req, res) {
        reservationsService.getCurrentReservations()
            .exec((err, reservation) => {
                const responseModel = new responses.ItemResponse()
                responseModel.item = reservation
                res.json(responseModel)
            })
            .catch((err) => {
                res.status(500).send(new responses.ErrorResponse(err))
            })
    }

    function checkInVehicle(req, res) {
        let queryCondition = {
            _id: req.params.id
        };
        reservationsService.checkInVehicle(queryCondition, req.body)
            .then((reservation) => {
                const responseModel = new responses.ItemResponse()
                res.status(201)
                    .json(responseModel)
            })
            .catch((err) => {
                return res.status(500).send(new responses.ErrorResponse(err.stack));
            })
    }

    function getLastMonthReservations(req, res) {
        let agencyId = req.params.id;
        let query = reservationsService.getLastMonthReservations(agencyId).exec();
        query
            .then((reservations) => {
                const responseModel = new responses.ItemsResponse();
                responseModel.items = reservations;
                res.json(responseModel);
            })
            .catch((err) => {
                res.status(500).send(new responses.ErrorResponse(err));
            });
    }

    function getCurrentMonthReservationProfitAndVehicleUsageTime(req, res) {
        let agencyId = req.user.agency;
        let query = reservationsService.getCurrentMonthReservationProfitAndVehicleUsageTime(agencyId).exec();
        query
            .then((reservations) => {
                const responseModel = new responses.ItemsResponse();
                responseModel.items = reservations;
                res.json(responseModel);
            })
            .catch((err) => {
                res.status(500).send(new responses.ErrorResponse(err));
            });
    }

   
    function getYearVehiclesUsageTime(req, res) {
        let params = req.query;
        let queryCondition = {
            agency: usersHelper.getAgencyId(req, res)
        };

        let query = reservationsService.getYearVehiclesUsageTime(params, queryCondition).exec();
        query
            .then((reservations) => {
                const responseModel = new responses.ItemsResponse();
                responseModel.items = reservations;
                res.json(responseModel);
            })
            .catch((err) => {
                res.status(500).send(new responses.ErrorResponse(err));
            });
    }

    function createPendingReservation(req, res) {
        let document = req.body;
        document.agency = usersHelper.getAgencyId(req, res);
        reservationsService.createPendingReservation(document)
            .then((reservation) => {
                const responseModel = new responses.ItemResponse();
                responseModel.item = reservation;
                res.status(201)
                    .location(path.join(apiPrefix, reservation._id.toString()))
                    .json(responseModel);
            })
            .catch((err) => {
                return res.status(500).send(new responses.ErrorResponse(err));
            })
    }

    function updateReservationStatus(req, res) {
        let document = req.body;
        let queryCondition = {
            _id: req.params.id
        };
        reservationsService.updateReservationStatus(queryCondition, document)
            .then((reservation) => {
                const responseModel = new responses.ItemResponse()
                res.status(201)
                    .json(responseModel)
            })
            .catch((err) => {
                return res.status(500).send(new responses.ErrorResponse(err.stack));
            })
    }

    function getVehiclesDateRangeUsageTime(req, res) {
        let params = req.query;
        let queryCondition = {
            agency: usersHelper.getAgencyId(req, res),
            // startDate: new Date(req.params.startDate),
            // endDate: new Date(req.params.endDate)
        };

        let query = reservationsService.getVehiclesDateRangeUsageTime(params, queryCondition).exec();
        query
            .then((reservations) => {
                const responseModel = new responses.ItemsResponse();
                responseModel.items = reservations;
                res.json(responseModel);
            })
            .catch((err) => {
                res.status(500).send(new responses.ErrorResponse(err));
            });
    }

    function searchReservationsGuests(req, res) {
        let queryCondition = req.params.text;
        reservationsService.searchReservationsGuests(queryCondition)
            .then((reservations) => {
                const responseModel = new responses.ItemsResponse();
                responseModel.items = reservations;
                res.json(responseModel);
            })
            .catch((err) => {
                res.status(500).send(new responses.ErrorResponse(err));
            });
    }

    function getTotalVehicleUsageTime(req, res) {
        let params = req.query;
        let queryCondition = {
            agency: usersHelper.getAgencyId(req, res),
            startDate: req.params.startDate,
            endDate: req.params.endDate
        };
        let query = reservationsService.getTotalVehicleUsageTime(params, queryCondition).exec();
        query
            .then((reservations) => {
                const responseModel = new responses.ItemsResponse();
                responseModel.items = reservations;
                res.json(responseModel);
            })
            .catch((err) => {
                res.status(500).send(new responses.ErrorResponse(err));
            });
    }

    function insertNewSearch(req, res) {
        let document = req.body;
        searchesService.insertNewSearch(document)
            .then((newSearch) => {
                const responseModel = new responses.ItemResponse();
                responseModel.item = newSearch;
                res.status(201)
                    .location(path.join(apiPrefix, newSearch._id.toString()))
                    .json(responseModel)
            })
            .catch((err) => {
                return res.status(500).send(new responses.ErrorResponse(err));
            });
    }

    function recentMongoSearches(req, res) {
        searchesService.recentMongoSearches()
            .then((query) => {
                const responseModel = new responses.ItemResponse();
                responseModel.items = query;
                res.json(responseModel);
            }).catch((err) => {
                res.status(500).send(new responses.ErrorResponse(err));
            });
    }

    function getMostUsedVehicles(req,res) {
        let queryCondition = {
            agency: usersHelper.getAgencyId(req, res),
            startDate: req.params.startDate,
            endDate: req.params.endDate
        };

        let query = reservationsService.getMostUsedVehicles(queryCondition).exec();
        query
            .then((reservations) => {
                const responseModel = new responses.ItemsResponse();
                responseModel.items = reservations;
                res.json(responseModel);
            })
            .catch((err) => {
                res.status(500).send(new responses.ErrorResponse(err));
            });
    }
}

