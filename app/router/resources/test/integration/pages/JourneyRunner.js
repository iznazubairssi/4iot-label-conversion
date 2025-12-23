sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"label/conversion/project1/test/integration/pages/RequestsMain"
], function (JourneyRunner, RequestsMain) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('label/conversion/project1') + '/test/flp.html#app-preview',
        pages: {
			onTheRequestsMain: RequestsMain
        },
        async: true
    });

    return runner;
});

