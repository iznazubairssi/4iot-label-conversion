namespace four_iot.conversion;

entity Requests {
    key ID                  : String(50);
    labelSoftware           : String(50);
    otherSoftwareName       : String(100);
    otherSoftwareWebsite    : String(200);
    numLabels               : Integer;
    conversionFonts         : Boolean;
    conversionFieldnames    : Boolean;
    comparisonPrintScan     : Boolean;
    supportADS              : Boolean;
    contactName             : String(100);
    contactMail             : String(100);
    contactPhone            : String(50);
    status                  : Integer;
    createdAt               : DateTime;
    azureRequestFile        : String;
    azureFolderName         : String(300);
}

entity RequestCounter {
    key id      : Integer default 1;
    counter     : Integer default 0;
}
