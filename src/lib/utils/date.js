import * as R from 'ramda';
import moment from 'moment';

export const getMoment = (date) => {
  if (!date) {
    return moment();
  }
  if (moment.isMoment(date)) {
    return date;
  }

  let theDate = moment();
  if (R.has('toDate', date)) {
    theDate = moment(date.toDate());
  }

  return theDate;
};

export const formatDate = (date, format = 'MMMM D, YYYY') => (
  date
    ? getMoment(date).format(format)
    : ''
);
