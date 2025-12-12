using { four_iot.conversion as my } from '../db/schema';

service ConversionService @(path: '/4iot/conversion') {

    entity Requests as projection on my.Requests;
}
