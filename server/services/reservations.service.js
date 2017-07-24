const mongoose = require('mongoose');
const Moment = require('moment');
const MomentRange = require('moment-range');
const moment = MomentRange.extendMoment(Moment);
const usersHelper = require('../helpers/usersHelper')();

module.exports = reservationsService;

function reservationsService(options) {
    let Reservation

    if (!options.modelService) {
        throw new Error('Options.modelService is required');
    }

    Reservation = options.modelService;

    return {
        getAllReservationStatuses: getAllReservationStatuses,
        gettingReservationByIdExt: gettingReservationByIdExt,
        getReservationsByDate: getReservationsByDate,
        getTodaysCustomerBaseMetrics: getTodaysCustomerBaseMetrics,
        getAllCustomerBaseMetrics: getAllCustomerBaseMetrics,
        getReservationsForLineChart: getReservationsForLineChart,
        getReservationsForPieChart: getReservationsForPieChart,
        getReservationsByVehicleIdDate: getReservationsByVehicleIdDate,
        getReservationMetrics: getReservationMetrics,
        getTopVehicleData: getTopVehicleData,
        getCurrentMonthReservationProfitAndVehicleUsageTime: getCurrentMonthReservationProfitAndVehicleUsageTime,
        checkOutVehicle: checkOutVehicle,
        getCurrentReservations: getCurrentReservations,
        getLastMonthReservations: getLastMonthReservations,
        getVehiclesDateRangeUsageTime: getVehiclesDateRangeUsageTime,
        getMostUsedVehicles: getMostUsedVehicles,
        getAll: getAll,
        getOne: getOne,
        insert: insert,
        updateOne: updateOne,
        removeOne: removeOne,
        search: search,
        checkInVehicle: checkInVehicle,
        getYearVehiclesUsageTime: getYearVehiclesUsageTime,
        getTotalVehicleUsageTime: getTotalVehicleUsageTime,
        createPendingReservation: createPendingReservation,
        updateReservationStatus: updateReservationStatus,
        searchReservationsGuests: searchReservationsGuests
    }

    function search(params, queryCondition) {
        let query = Reservation.find(queryCondition);

        if (params.dateRangeStart) {
            query.where('reservationDate').gte(new Date(params.dateRangeStart))
        }

        if (params.dateRangeEnd) {
            query.where('reservationDate').lte(new Date(params.dateRangeEnd))
        }

        if (params.reservationStatus) {
            query.where('reservationStatus').eq(params.reservationStatus)
        }

        return query;
    }


    function gettingReservationByIdExt(queryCondition) {
        return Reservation.findOne(queryCondition)
            .populate('vehicle')
    }

    function getAll(queryCondition) {

        return Reservation.find(queryCondition);
    }

    function getOne(queryCondition) {
        return Reservation.findOne(queryCondition);
    }

    function insert(document) {
        let reservation = new Reservation(document);
        return reservation.save();
    }

    function updateOne(queryCondition, doc) {
        return Reservation.findOneAndUpdate(queryCondition, doc, {
            new: true
        });
    }

    function checkOutVehicle(queryCondition, doc) {
        var doc = {
            $set: {
                'reservationStatus': 'Checked Out',
                'metrics.checkOutDate': new Date()
            }
        }
        return Reservation.findOneAndUpdate(queryCondition, doc, {
            new: true
        });
    }

    function removeOne(queryCondition) {
        return Reservation.findOneAndRemove(queryCondition);
    }

    function getReservationsByDate(queryCondition) {
        return Reservation.find(queryCondition)
            .populate('user vehicle');
    }

    function getTodaysCustomerBaseMetrics(queries, user) {
        let dtStart = new Date(queries.dtStart);
        let dtEnd = new Date(queries.dtEnd);
        let reservationStat = queries.reservationStatus;
        let query = Reservation
            .aggregate()

        if (reservationStat) {
            query.match({ 'reservationStatus': { $eq: reservationStat } })
        }
        return Reservation.find({
            "reservationDate": { $lte: new Date(dtEnd), $gte: new Date(dtStart) }
        })
    }

    function getAllCustomerBaseMetrics(params, queryCondition) {
        // let reservationStat = params.reservationStatus;

        return Reservation.find({
            reservationStatus: "Finalized"
        }).count()
    }

    function getReservationsForLineChart(params, queryCondition) {
        debugger;
        let date = moment();
        let dtStart = new Date(new Date(params.query.dtStart).getTime()); //to-do: should we create a mongo date here?
        // let dtStart2 = params.query.dtStart;
        let dtEnd = new Date(new Date(params.query.dtEnd).setHours(0, 0, 0, 0)); // and here?
        debugger;
        let reservationStat = params.reservationStatus;
        let source = params.source;

        let days =  [dtStart];
        let timeDiff = Math.abs(dtEnd.getTime() - dtStart.getTime())
        let oneDay = 86400000;
        let daysDiff = Math.ceil(timeDiff / oneDay);
        for (var i = 1; i < daysDiff; i++) {
            days.push(new Date(dtStart.getTime() + oneDay * i));
        }
        let daysEndDiff = Math.abs(dtEnd.getTime() - days[days.length - 1]) / oneDay;
        if (daysEndDiff > 1)
            days.push(dtEnd);
        else if (daysEndDiff < 1)
            days[days.length - 1] = dtEnd;

        let query = Reservation
            .aggregate()

        // if (reservationStat) {
        //     query.match({ 'reservationStatus': { $eq: reservationStat } })
        // }

        if (dtStart) {
            query
                .match({ 'reservationDate': { $gte: dtStart } })
        }
        if (dtEnd) {

            query
                .match({ 'reservationDate': { $lte: dtEnd } })
        }

        return query
            .group({
                _id: { date: "$reservationDate" },
                "value": { "$sum": { "$cond": [{ "$eq": ["$source", "Helm"] }, 1, 0] } },
                "valueTwo": { "$sum": { "$cond": [{ "$eq": ["$source", "Consumer"] }, 1, 0] } }
            })
            .group({
                _id: "$_id.name",
                days: { $addToSet: "$_id.reservationDate" },
                docs: { $push: "$$ROOT" }
            })
            .project({
                missingDays: { $setDifference: [days, "$days"] }, docs: 1
            })
            .unwind("$missingDays")
            .unwind("$docs")
            .group({
                _id: "$_id",
                days: { $addToSet: { date: "$docs._id.date", value: "$docs.value", valueTwo: "$docs.valueTwo" } },
                missingDays: { $addToSet: { date: "$missingDays", value: { $literal: 0 } } }
            })
            .project({
                _id: 0,
                date: { $setUnion: ["$days", "$missingDays"] }
            })
            .unwind("$date")
            .project({
                _id: 0, 
                "reservationDate": { "$dateToString": { "format": '%Y-%m-%dT00:00:00Z', "date": '$date.date' } },
                "source": "$date.value",
                "sourceTwo": "$date.valueTwo"
            })
            .group({
                _id: { date: "$reservationDate" },
                value: { "$sum": "$source" },
                valueTwo: { "$sum": "$sourceTwo" }
            })
            .project({
                _id: 0,
                date: "$_id.date",
                Helm: "$value",
                Consumer: "$valueTwo"
            })
            .sort({ date: 1 })
            .exec();
    }
    
    function getReservationsForPieChart(params, queryCondition) {
        debugger;
        let date = moment();
        let dtStart = new Date(params.query.dtStart).getTime();
        let dtEnd = new Date(params.query.dtEnd).getTime();
        let reservationStat = params.reservationStatus;
        let source = params.source;
        let query = Reservation
            .aggregate()

        // if (reservationStat) {
        //     query.match({ 'reservationStatus': { $eq: reservationStat } })
        // }

        if (dtStart) {
            var startDate = new Date(dtStart);
            startDate.setHours(0);
            startDate.setSeconds(0);
            startDate.setMinutes(0);

            query
                .match({ 'reservationDate': { $gte: startDate } })
        }
        if (dtEnd) {
            var dateMidnight = new Date(dtEnd);
            dateMidnight.setHours(23);
            dateMidnight.setMinutes(59);
            dateMidnight.setSeconds(59);

            query
                .match({ 'reservationDate': { $lte: dateMidnight } })
        }

        return query
            .group({
                _id: "$_id",
                "Helm":
                {
                    "$sum":
                    {
                        "$cond":
                        [
                            {
                                "$eq":
                                [
                                    "$source",
                                    "Helm"
                                ]
                            }, 1, 0
                        ]
                    }
                },
                "Consumer":
                {
                    "$sum":
                    {
                        "$cond":
                        [
                            {
                                "$eq":
                                [
                                    "$source",
                                    "Consumer"
                                ]
                            }, 1, 0
                        ]
                    }
                }
        })
        .project({_id: 0, Helm: "$Helm", Consumer: "$Consumer"})
            .exec();
    }

    function getReservationsByVehicleIdDate(queryCondition) {
        return Reservation.find(queryCondition)
            .populate('user');
    }

    function getTopVehicleData(req, res) {
        let dateFrom = req.query.dateFrom;
        let dateEnd = req.query.dateEnd;
        let serialNumber = req.query.serialNumber;
        let vehicleType = req.query.vehicleType;

        let query = Reservation
            .aggregate()
            .lookup({
                from: "vehicles",
                localField: "vehicle",
                foreignField: "_id",
                as: "vehicle_docs"
            }
            )
        // if (usersHelper.getAgencyId(req, res)) {
        //     query
        //         .match({ 'agency': usersHelper.getAgencyId(req, res) })
        // }
        if (dateFrom) {
            var startDate = new Date(dateFrom);
            startDate.setHours(0);
            startDate.setSeconds(0);
            startDate.setMinutes(0);

            query
                .match({ 'reservationDate': { $gte: startDate } })
        }
        if (dateEnd) {
            var dateMidnight = new Date(dateEnd);
            dateMidnight.setHours(23);
            dateMidnight.setMinutes(59);
            dateMidnight.setSeconds(59);

            query
                .match({ 'reservationDate': { $lte: dateMidnight } })
        }
        if (vehicleType) {
            query
                .match({ 'vehicle_docs.type': { $eq: vehicleType } })
        }
        if (serialNumber) {
            query
                .match({ 'vehicle_docs.serialNumber': { $eq: serialNumber } })
        }
        return query
            .project({
                vehicle: '$vehicle_docs._id'
                , vehicleName: '$vehicle_docs.name'
                , vehicleType: '$vehicle_docs.type'
                , vehicleSerialNumber: '$vehicle_docs.serialNumber'
                , vehicleReservationStatus: "$reservationStatus"
                , actualChargedAmount: "$metrics.actualChargedAmount"
                , profitDifference: "$metrics.profitDifference"
                , absValueProfitDifference: {
                    $cond: [
                        { $lt: ['$metrics.profitDifference', 0] }
                        , { $subtract: [0, '$metrics.profitDifference'] }
                        , '$metrics.profitDifference'
                    ]
                }
                , actualDuration: "$metrics.actualDuration"
                , timeDifference: '$metrics.timeDifference'
                , absValuetimeDifference: {
                    $cond: [
                        { $lt: ['$metrics.timeDifference', 0] }
                        , { $subtract: [0, '$metrics.timeDifference'] }
                        , '$metrics.timeDifference'
                    ]
                }
            })
            .group({
                _id: '$vehicle'
                , numberOfReservations: { $sum: 1 }
                , vehicleName: { $first: '$vehicleName' }
                , vehicleType: { $first: '$vehicleType' }
                , vehicleSerialNumber: { $first: '$vehicleSerialNumber' }
                , vehicleReservationStatus: { $first: '$vehicleReservationStatus' }
                , totalVehicleProfit: { $sum: '$actualChargedAmount' }
            }
            )
            .sort({
                totalVehicleProfit: -1
            })
            .exec()
    }

     function getReservationMetrics(req, res) {
        let dateFrom = req.query.dateFrom;
        let dateEnd = req.query.dateEnd;
        let serialNumber = req.query.serialNumber;
        let vehicleType = req.query.vehicleType;
     
        let query = Reservation
            .aggregate()
            .lookup({
                from: "vehicles",
                localField: "vehicle",
                foreignField: "_id",
                as: "vehicle_docs"
            })
        if (dateFrom) {
            var startDate = new Date(dateFrom);
            startDate.setHours(0);
            startDate.setSeconds(0);
            startDate.setMinutes(0);
          
            query
                .match({ 'reservationDate': { $gte: startDate } })
        }
        if (dateEnd) {
            var dateMidnight = new Date(dateEnd);
            dateMidnight.setHours(23);
            dateMidnight.setMinutes(59);
            dateMidnight.setSeconds(59);
       
            query
                .match({ 'reservationDate': { $lte: dateMidnight } })
        }
        if (vehicleType) {
            query
                .match({ 'vehicle_docs.type': { $eq: vehicleType } })
        }
        if (serialNumber) {
            return query
                .match({ 'vehicle_docs.serialNumber': { $regex: serialNumber } })
                .project({
                    vehicle: '$vehicle_docs._id'
                    , vehicleName: '$vehicle_docs.name'
                    , vehicleType: '$vehicle_docs.type'
                    , vehicleSerialNumber: '$vehicle_docs.serialNumber'
                    , actualChargedAmount: "$metrics.actualChargedAmount"
                    , profitDifference: "$metrics.profitDifference"
                    , absValueProfitDifference: {
                        $cond: [
                            { $lt: ['$metrics.profitDifference', 0] }
                            , { $subtract: [0, '$metrics.profitDifference'] }
                            , '$metrics.profitDifference'
                        ]
                    }
                    , actualDuration: "$metrics.actualDuration"
                    , timeDifference: '$metrics.timeDifference'
                    , absValuetimeDifference: {
                        $cond: [
                            { $lt: ['$metrics.timeDifference', 0] }
                            , { $subtract: [0, '$metrics.timeDifference'] }
                            , '$metrics.timeDifference'
                        ]
                    }
                })
                .group({
                    _id: '$vehicle'
                    , vehicleName: { $first: '$vehicleName' }
                    , vehicleType: { $first: '$vehicleType' }
                    , vehicleSerialNumber: { $first: '$vehicleSerialNumber' }
                    , actualChargedAmount: { $sum: "$actualChargedAmount" }
                    , profitDifference: { $sum: "$profitDifference" }
                    , absValueProfitDifference: { $sum: "$absValueProfitDifference" }
                    , actualDuration: { $sum: "$actualDuration" }
                    , timeDifference: { $sum: '$timeDifference' }
                    , absValuetimeDifference: { $sum: '$absValuetimeDifference' }
                }
                )
                .exec()
        }
        return query
            .project({
                vehicleName: '$vehicle_docs.name'
                , vehicleType: '$vehicle_docs.type'
                , actualChargedAmount: "$metrics.actualChargedAmount"
                , profitDifference: "$metrics.profitDifference"
                , absValueProfitDifference: {
                    $cond: [
                        { $lt: ['$metrics.profitDifference', 0] }
                        , { $subtract: [0, '$metrics.profitDifference'] }
                        , '$metrics.profitDifference'
                    ]
                }
                , actualDuration: "$metrics.actualDuration"
                , timeDifference: '$metrics.timeDifference'
                , absValuetimeDifference: {
                    $cond: [
                        { $lt: ['$metrics.timeDifference', 0] }
                        , { $subtract: [0, '$metrics.timeDifference'] }
                        , '$metrics.timeDifference'
                    ]
                }
            })
            .group({
                _id: null
                , actualChargedAmount: { $sum: "$actualChargedAmount" }
                , profitDifference: { $sum: "$profitDifference" }
                , absValueProfitDifference: { $sum: "$absValueProfitDifference" }
                , actualDuration: { $sum: "$actualDuration" }
                , timeDifference: { $sum: '$timeDifference' }
                , absValuetimeDifference: { $sum: '$absValuetimeDifference' }
            }
            )
            .exec()
    }

function getAllReservationStatuses() {
    var startDate = new Date();
    startDate.setSeconds(0);
    startDate.setHours(0);
    startDate.setMinutes(0);

    var dateMidnight = new Date(startDate);
    dateMidnight.setHours(23);
    dateMidnight.setMinutes(59);
    dateMidnight.setSeconds(59);

    return Reservation
        .aggregate([
            {
                $match: { reservationDate: { $lt: dateMidnight, $gte: startDate } }
            },
            {
                $group:
                {
                    _id: '$reservationStatus',
                    count: { $sum: 1 }
                }
            }
        ])
}

function getCurrentReservations(reservationDate) {
    return Reservation
        .find({
            $where: function () {
                return new Date() < new Date(this.reservationDate.getTime() + this.expectedDuration * 60 * 60 * 1000) &&
                    new Date() > this.reservationDate
            }
        })
}


function checkInVehicle(queryCondition) {
    doc = {
        $set: {
            'reservationStatus': 'Checked In',
            'metrics.checkInDate': new Date()
        }
    }
return Reservation.findOneAndUpdate(queryCondition, doc, {
    new: true
});
}


function getLastMonthReservations(agencyId) {
    let lastMonth = moment(new Date()).subtract(1, 'month');

    return Reservation
        .aggregate([
            {
                $match: {
                    agency: mongoose.Types.ObjectId(agencyId),
                    reservationDate: {
                        $gte: new Date(lastMonth.startOf('month').format()),
                        $lte: new Date(lastMonth.endOf('month').format())
                    }
                }
            },
            {
                $lookup: {
                    from: "vehicles",
                    localField: "vehicle",
                    foreignField: "_id",
                    as: "vehicle_docs"
                }
            },
            {
                $project: {
                    vehicleType: "$vehicle_docs.type",
                    actualChargedAmount: "$metrics.actualChargedAmount"
                }
            },
            {
                $group: {
                    _id: "$vehicleType",
                    reservations: {
                        $push: "$_id"
                    },
                    totalChargedAmount: {
                        $sum: "$actualChargedAmount"
                    },
                    count: {
                        $sum: 1
                    }
                }
            },
        ]);
}

function getCurrentMonthReservationProfitAndVehicleUsageTime(agencyId) {
        let currentMonth = moment(new Date());
        return Reservation
            .aggregate([
                {
                    $match: {
                        agency: mongoose.Types.ObjectId(agencyId),
                        reservationDate: {
                            $gte: new Date(currentMonth.startOf('month').format()),
                            $lte: new Date()
                        }
                    }
                }
                ,
                {
                    $project: {
                        actualChargedAmount: "$metrics.actualChargedAmount"
                        , actualDuration: "$metrics.actualDuration"
                    }
                },
                {
                    $group: {
                        _id: "",
                        currentMonthProfit: {
                            $sum: "$actualChargedAmount"
                        },
                        currentMonthUsageTime: {
                            $sum: "$actualDuration"
                        }
                    }
                }
            ]);
    }

function getVehiclesUsageTime(params, queryCondition) {
    let agencyId = queryCondition.agency

    if (params.id) {
        return Reservation
            .aggregate([
                {
                    $match: {
                        agency: mongoose.Types.ObjectId(agencyId),
                        reservationDate: {
                            $gte: new Date(lastMonth.startOf('month').format()),
                            $lte: new Date(lastMonth.endOf('month').format())
                        },
                        source: 'Helm'
                    }
                },
                {
                    $group: {
                        _id: mongoose.Types.ObjectId(params.id),
                        vehicleUsageTime: { $sum: '$metrics.actualDuration' }
                    }
                }
            ])
    }
    if (params.dateRangeStart && params.dateRangeEnd) {
        return Reservation
            .aggregate([
                {
                    $match: {
                        agency: mongoose.Types.ObjectId(agencyId),
                        reservationDate: { $gte: new Date(params.dateRangeStart) },
                        reservationEndDate: { $lte: new Date(params.dateRangeEnd) }
                    }
                },
                {
                    $group: {
                        _id: '$vehicle',
                        vehicleUsageTime: { $sum: '$metrics.actualDuration' }
                    }
                }
            ])
    }
    function getCurrentMonthReservationProfitAndVehicleUsageTime(agencyId) {
        let currentMonth = moment(new Date());

        return Reservation
            .aggregate([
                {
                    $match: {
                        agency: mongoose.Types.ObjectId(agencyId),
                        reservationDate: { $gte: new Date(params.dateRangeStart) },
                        reservationEndDate: { $lte: new Date(params.dateRangeEnd) },
                        reservationDate: {
                            $gte: new Date(currentMonth.startOf('month').format()),
                            $lte: new Date()
                        }

                    }
                }
                ,
                {
                    $project: {
                        actualChargedAmount: "$metrics.actualChargedAmount"
                        , actualDuration: "$metrics.actualDuration"
                    }

                },
                {
                    $group: {
                        _id: "",
                        currentMonthProfit: {
                            $sum: "$actualChargedAmount"
                        },
                        currentMonthUsageTime: {
                            $sum: "$actualDuration"
                        }
                    }

                }
            ]);
    }
    }


    function getAvailableVehiclesByDate(queryCondition) {
        let query = Reservation.find()
        if (queryCondition.desiredReservationStartDate && queryCondition.desiredReservationEndDate && queryCondition.guestCount) {
            query
                .where('reservationStatus')
                .eq('Maintenance')
                .eq('Pending')
                .eq('Checked Out')
                .eq('Checked In')

                .where('reservationDate')
                .gt(new Date(queryCondition.desiredReservationStartDate))
                .lt(new Date(queryCondition.desiredReservationEndDate))
                .where('reservationEndDate')
                .gt(new Date(queryCondition.desiredReservationStartDate))
                .lt(new Date(queryCondition.desiredReservationEndDate))
            query.select('vehicle')

        }
        return query
    }

    function getYearVehiclesUsageTime(params, queryCondition) {
        let todaysDate = new Date()
        let endOfThisMonth = moment(todaysDate).endOf('month')
        let startOfYear = moment(todaysDate).startOf('year')
        // let endOfYear = moment(todaysDate).endOf('year')
        let agencyId = queryCondition.agency
        let query = Reservation.aggregate()

        let months = []
        for (let startDate = new Date(startOfYear); startDate <= new Date(endOfThisMonth); startDate.setDate(startDate.getDate() + 31)) {
            let monthString = moment(new Date(startDate)).format('MMM')
            months.push(monthString);
        }

        let ifNov = { $cond: [{ $eq: [11, "$month"] }, "Nov","Dec"] }
        let ifOct = { $cond: [{ $eq: [10, "$month"] }, "Oct", ifNov] }
        let ifSep = { $cond: [{ $eq: [9, "$month"] }, "Sep", ifOct] }
        let ifAug = { $cond: [{ $eq: [8, "$month"] }, "Aug", ifSep] }
        let ifJul = { $cond: [{ $eq: [7, "$month"] }, "Jul", ifAug] }
        let ifJun = { $cond: [{ $eq: [6, "$month"] }, "Jun", ifJul] }
        let ifMay = { $cond: [{ $eq: [5, "$month"] }, "May", ifJun] }
        let ifApr = { $cond: [{ $eq: [4, "$month"] }, "Apr", ifMay] }
        let ifMar = { $cond: [{ $eq: [3, "$month"] }, "Mar", ifApr] }
        let ifFeb = { $cond: [{ $eq: [2, "$month"] }, "Feb", ifMar] }
        let monthOfYear = { $cond: [{ $eq: [1, "$month"] }, "Jan", ifFeb] }

        if (params.id) {
            query
                .match({
                    agency: mongoose.Types.ObjectId(agencyId),
                    reservationDate: {
                        $gte: new Date(startOfYear),
                        $lte: todaysDate,
                    },
                    vehicle: mongoose.Types.ObjectId(params.id)
                })
        }
        else {
            query
                .match({
                    agency: mongoose.Types.ObjectId(agencyId),
                    reservationDate: {
                        $gte: new Date(startOfYear),
                        $lte: todaysDate,
                    },
                })
        }
        return query
            .project({
                vehicleId: '$vehicle',
                monthOfYear: { $month: "$reservationDate" },
                usageTime: { $sum: '$expectedDuration' },
            })
            .lookup({
                from: "vehicles",
                localField: "vehicleId",
                foreignField: "_id",
                as: "_id.vehicle"
            })
            .group({
                _id: {
                    vehicleName: '$_id.vehicle.name',
                    monthNumber: '$monthOfYear'
                },
                time: { $sum: '$usageTime' },
            })
            .sort({
                '_id.monthNumber': 1
            })
            .project({
                "_id": 0,
                "vehicle": "$_id.vehicleName",
                "month": "$_id.monthNumber",
                "vehicleUsageTime": "$time"

            })
            .project({
                "key": "$vehicle",
                "month": monthOfYear,
                "vehicleUsageTime": "$vehicleUsageTime"
            })
            .group({
                _id: "$key",
                month: { $addToSet: "$month" },
                values: { $push: { label: "$month", value: "$vehicleUsageTime" } }
            })
            .project({ missingMonths: { $setDifference: [months, "$month"] }, values: 1 })
            .unwind("$missingMonths")
            .unwind("$values")
            .group({
                _id: "$_id",
                values: { $addToSet: { label: "$values.label", value: "$values.value" } },
                missingMonths: { $addToSet: { label: "$missingMonths", value: { $literal: 0 } } }
            })
            .project({ "_id": 0, "key": '$_id', values: { $setUnion: ["$values", "$missingMonths"] } })
}

    function createPendingReservation(document) {
        document.reservationStatus = 'Pending';
        document.metrics = { 'pendingDate': new Date() };
        let reservation = new Reservation(document);
        return reservation.save();
    }

    function updateReservationStatus(queryCondition, document) {
        document.reservationStatus = 'Pending';
        document.metrics = { 'pendingDate': new Date() };
        return Reservation.findOneAndUpdate(queryCondition, document, {
            new: true
        });
    }

    function getVehiclesDateRangeUsageTime(params, queryCondition) {
        let start = new Date(params.startDate)
        let endDate = new Date(params.endDate)

        let days = []
        for (let startDate = new Date(params.startDate); startDate <= endDate; startDate.setDate(startDate.getDate() + 1)) {
            let date = new Date(startDate)
            let momentDate = moment(date).add(1, 'd')
            let stringDate = momentDate.format('M-D-YYYY')
            days.push(stringDate);
        }

        let agencyId = queryCondition.agency
        let query = Reservation.aggregate()

        if (params.id) {
            query
                .match({
                    agency: mongoose.Types.ObjectId(agencyId),
                    reservationDate: {
                        $gte: start,
                        $lte: endDate,
                    },
                    vehicle: mongoose.Types.ObjectId(params.id)
                })
        }
        else {
            query
                .match({
                    agency: mongoose.Types.ObjectId(agencyId),
                    reservationDate: {
                        $gte: start,
                        $lte: endDate,
                    },
                })
        }
        return query
            .group({
                _id: {
                    vehicle: '$vehicle',
                    dayOfWeek: { $dayOfWeek: "$reservationDate" },
                    "date": {
                        "$concat": [
                            { "$substr": [{ "$month": "$reservationDate" }, 0, 2] }, "-",
                            { "$substr": [{ "$dayOfMonth": "$reservationDate" }, 0, 2] }, "-",
                            { "$substr": [{ "$year": "$reservationDate" }, 0, 4] }
                        ]
                    }
                },
                vehicleUsageTime: { $sum: '$expectedDuration' },
                // vehicleUsageTime: { $sum: '$metrics.actualDuration' }
            })
            .lookup({
                from: "vehicles",
                localField: "_id.vehicle",
                foreignField: "_id",
                as: "_id.vehicle"
            })
            .group({
                _id: {
                    vehicle: '$_id.vehicle.name',
                },
                days: { $addToSet: "$_id.date" },
                values: { $push: { label: '$_id.date', value: '$vehicleUsageTime' } },
            })
            .project({ missingDays: { $setDifference: [days, "$days"] }, values: 1 })
            .unwind("$missingDays")
            .unwind("$values")
            .group({
                _id: "$_id",
                values: { $addToSet: { label: "$values.label", value: "$values.value" } },
                missingDays: { $addToSet: { label: "$missingDays", value: { $literal: 0 } } }
            })
            .project({ "_id": 0, "key": '$_id.vehicle', values: { $setUnion: ["$values", "$missingDays"] } })

    }

    function getTotalVehicleUsageTime(params, queryCondition) {
        let startDate = moment(new Date(queryCondition.startDate)).startOf('day')
        let endDate = moment(new Date(queryCondition.endDate)).endOf('day')
        let agencyId = queryCondition.agency
        let query = Reservation.aggregate()

        query
            .match({
                reservationDate: {
                    $gte: new Date(startDate.format()),
                    $lte: new Date(endDate.format()),
                },
            })

        return query
            .group({
                _id: {
                    agency: mongoose.Types.ObjectId(agencyId),
                },
                vehiclesUsageTime: { $sum: '$expectedDuration' },
                // vehicleUsagesTime: { $sum: '$metrics.actualDuration' }
            })
    }

    function searchReservationsGuests(val) {
        return Reservation.find({ $or: [{ 'reservationGuests.firstName': new RegExp(val, 'i') }, { 'reservationGuests.lastName': new RegExp(val, 'i') }, { 'reservationGuests.email': new RegExp(val, 'i') }, { 'reservationGuests.phone': new RegExp(val, 'i') }] });
    }

    function getMostUsedVehicles(queryCondition) {
        let startDate = moment(new Date(queryCondition.startDate)).startOf('day')
        let endDate = moment(new Date(queryCondition.endDate)).endOf('day')
        let agencyId = queryCondition.agency
        let query = Reservation.aggregate()

        query
            .match({
                agency: mongoose.Types.ObjectId(agencyId),
                reservationDate: {
                    $gte: new Date(startDate.format()),
                    $lte: new Date(endDate.format()),
                },
            })

        return query
            .group({
                _id: {
                    vehicle: '$vehicle',
                    vehicleId: '$vehicle',
                    agency: mongoose.Types.ObjectId(agencyId),
                },
                vehicleUsageTime: { $sum: '$expectedDuration' },
                // vehicleUsagesTime: { $sum: '$metrics.actualDuration' }
            })
            .lookup({
                from: "vehicles",
                localField: "_id.vehicle",
                foreignField: "_id",
                as: "_id.vehicle"
            })
            .group({
                _id: {
                    vehicle: '$_id.vehicle.name',
                    vehicleId: '$_id.vehicleId'
                },
                vehicleUsageTime: { $push: { hours: '$vehicleUsageTime' } },
            })
            .sort({
                'vehicleUsageTime.hours': -1
            })

    }
}

