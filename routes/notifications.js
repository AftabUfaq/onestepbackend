var express = require('express');
var router = express.Router();
const admin = require("firebase-admin");
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

module.exports = router;
