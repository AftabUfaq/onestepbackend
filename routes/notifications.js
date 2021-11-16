var express = require('express');
var router = express.Router();
const admin = require("firebase-admin");
const  moment = require('moment')
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('../config/adminsdk.json');
initializeApp({credential: cert(serviceAccount)});
  router.post('/', async function(req, res, next) {
      const db = getFirestore();
      const bookingid = req.body.id
      const snapshot =  await db.collection('osb_booking').doc(`${bookingid}`).get();
      const booking_data = snapshot.data();
      const APPOINTMENT_PATIENT_ID = booking_data.APPOINTMENT_PATIENT_ID;
      const APPOINTMENT_DOCTOR_ID = booking_data.APPOINTMENT_DOCTOR_ID ;
      const PATIENT_DATA = await (await db.collection('osb_user').doc(`${APPOINTMENT_PATIENT_ID}`).get()).data();
      const DOCTOR_DATA = await (await db.collection('osb_user').doc(`${APPOINTMENT_DOCTOR_ID}`).get()).data();
      const patient_fcm = PATIENT_DATA.USER_FCM
      const doctor_fcm = DOCTOR_DATA.USER_FCM

      const doctor_message = {
        notification: {
          title: "New Booking Request",
          body: `You have a new booking request from ${PATIENT_DATA.USER_NAME}`,
        },
      }
      const patientmessage = {
        notification: {
          title: "Booking Request",
          body: `Your booking request has sent ${DOCTOR_DATA.USER_NAME}`,
        },
      }
      admin.messaging().sendToDevice(patient_fcm, patientmessage)
      .then(function (response) {
          console.log("Successfully sent message:", response);
      })
      .catch(function (error) {
          console.log("Error sending message:", error);
      });

      admin.messaging().sendToDevice(doctor_fcm, doctor_message)
      .then(function (response) {
          console.log("Successfully sent message:", response);
      })
      .catch(function (error) {
          console.log("Error sending message:", error);
      });

    res.send(`respond with a resource ss ${bookingid}`);
  });

  router.post("/processbooking", async function(req, res, next) {
    const db = getFirestore();
    const bookingid = req.body.id
    const response = req.body.response
     db.collection("osb_booking").doc(`${bookingid}`).update({
      APPOINTMENT_STATUS:response
     })
    const snapshot =  await db.collection('osb_booking').doc(`${bookingid}`).get();
    const booking_data = snapshot.data();
    const APPOINTMENT_PATIENT_ID = booking_data.APPOINTMENT_PATIENT_ID;
    const APPOINTMENT_DOCTOR_ID = booking_data.APPOINTMENT_DOCTOR_ID ;
    const PATIENT_DATA = await (await db.collection('osb_user').doc(`${APPOINTMENT_PATIENT_ID}`).get()).data();
    const DOCTOR_DATA = await (await db.collection('osb_user').doc(`${APPOINTMENT_DOCTOR_ID}`).get()).data();
    const patient_fcm = PATIENT_DATA.USER_FCM
    const doctor_fcm = DOCTOR_DATA.USER_FCM

    const doctor_message = {
      notification: {
        title: "Booking Update",
        body: `You have ${response} booking request of ${PATIENT_DATA.USER_NAME}`,
      },
    }
    const patientmessage = {
      notification: {
        title: "Booking Update",
        body: `Your booking request has been ${response} by ${DOCTOR_DATA.USER_NAME}`,
      },

    }
    admin.messaging().sendToDevice(patient_fcm, patientmessage)
    .then(function (response) {
        console.log("Successfully sent message:", response);
    })
    .catch(function (error) {
        console.log("Error sending message:", error);
    });

    admin.messaging().sendToDevice(doctor_fcm, doctor_message)
    .then(function (response) {
        console.log("Successfully sent message:", response);
    })
    .catch(function (error) {
        console.log("Error sending message:", error);
    });

      res.send(`respond with a resource ss ${bookingid}`);
  });

  router.post("/getslots", async function(req, res, next){
    const db = getFirestore();
    const date = req.body.date
    const doctorid = req.body.doctorid
    const start_time = req.body.start_time
    const end_time = req.body.end_time
    const slot_duration  = req.body.slot_duration
    const bookingsdata = []
    const allbooking = await db.collection("osb_booking").where("APPOINTMENT_DATE", "==", `${date}`).get()
      allbooking.docs.map((item) => {
      let dd = item.data()
      if(dd.APPOINTMENT_DOCTOR_ID == doctorid){
        bookingsdata.push(item.data())
      }
    })

    const doctor_start_time = new Date(`${date} ` + start_time).getHours();
    const doctor_end_time = new Date(`${date} ` + end_time).getHours();
    const time_slots =  await getTimeStops(doctor_start_time,doctor_end_time,slot_duration)
    const exact_slots =  finddislableslots(time_slots, bookingsdata,date, slot_duration )
    res.send({'status':true, time_slots:exact_slots});
  })


  router.post("/getcustomerbooking", async function(req, res, next){
    const db = getFirestore();

    const doctorid = req.body.customerid
    let bookingsdata = []

    const allbooking = await db.collection("osb_booking").where("APPOINTMENT_PATIENT_ID", "==", `${doctorid}`).get()
    allbooking.docs.map((item) => {

      bookingsdata.push(item.data())
    })
    res.send({'status':true, bookings:bookingsdata});
  })


  router.post("/getdoctorbooking", async function(req, res, next){
    const db = getFirestore();
    const doctorid = req.body.doctorid
    let bookingsdata = []
    const allbooking = await db.collection("osb_booking").where("APPOINTMENT_DOCTOR_ID", "==", `${doctorid}`).get()
    allbooking.docs.map((item) => {
      bookingsdata.push(item.data())
    })
    res.send({'status':true, bookings:bookingsdata});
  })

  async function getTimeStops(start,end,slotitme){
    var startTime = moment(start, 'HH:mm');
    var endTime = moment(end, 'HH:mm');
    if(endTime.isBefore(startTime) ){
      endTime.add(1, 'day');
    }

    var timeStops = [];
        while(startTime <= endTime){
            timeStops.push({time:moment(startTime).format('HH:mm'), avaliability:true});
            startTime.add(slotitme, 'minutes');
            startTime = moment(startTime, 'HH:mm')
    }
    return timeStops;
  }

   function  finddislableslots(time_slots, bookingsdata, date, slot_duration){
    const newslots = []
      time_slots.forEach(async (element , index) => {
        const dd = getslotalaliability(element, bookingsdata, date, slot_duration)
        newslots.push({...element, avaliability:dd})
      });
    return newslots
  }

   function getslotalaliability(slot,bookingsdata, date, slot_duration){
    let slot_time = moment(new Date(`${date} ` + slot.time)).format("x")
    let slot_end_time =  moment(new Date(`${date} ` + slot.time)).add(`${slot_duration}`, "minutes").format("x")
    let ava = true
      for (let i = 0; i < bookingsdata.length; i++) {
        let booking_time = moment(new Date(`${date} ` + bookingsdata[i].START_TIME)).format("x")
        let booking_end_time =  moment(new Date(`${date} ` + bookingsdata[i].START_TIME)).add(`${bookingsdata[i].APPOINTMENT_TOTAL_TIME}`, "minutes").format("x")
        if((slot_time >= booking_time && slot_time <=  booking_end_time) || (slot_end_time  >= booking_end_time && slot_end_time <= booking_end_time)){
          ava = false
          break;
        }
      }
      return ava
    //       bookingsdata.forEach((element, index, array) => {
    //             let booking_time = moment(new Date(`${date} ` + element.START_TIME)).format("x")
    //             let booking_end_time =  moment(new Date(`${date} ` + element.START_TIME)).add(`${element.APPOINTMENT_TOTAL_TIME}`, "minutes").format("x")
    //             if((slot_time >= booking_time && slot_time <=  booking_end_time) || (slot_end_time  >= booking_end_time && slot_end_time <= booking_end_time)){
    //               resolve(false);
    //             }
    //             if(index === array.length -1){
    //                 resolve(true);
    //             }
    //         });

    // })
}
module.exports = router;
