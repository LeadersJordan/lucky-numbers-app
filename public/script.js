// Firebase Configuration - YOU MUST REPLACE THIS WITH YOUR FIREBASE PROJECT CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyBDn3KtNMkAxAJyetr4orBwXM8zP5_SAE",
    authDomain: "leaders-lucky-number.firebaseapp.com",
    projectId: "leaders-lucky-number",
    storageBucket: "leaders-lucky-number.firebasestorage.app",
    messagingSenderId: "942024747500",
    appId: "1:942024747500:web:022a072eefeb908a68f8c9",
    measurementId: "G-9HE0WBBVQX"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

$(document).ready(function() {
    const gridContainer = $('#llnc-number-grid');
    const modal = $('#llnc-modal');
    const closeBtn = $('.llnc-close');
    const form = $('#llnc-claim-form');
    const messages = $('#llnc-form-messages');
    const submitBtn = $('#llnc-submit-btn');
    const inputNumber = $('#llnc-input-number');
    const displaySelectedNumber = $('#llnc-selected-number-display');

    const TOTAL_NUMBERS = 1000;
    
    // Get today's date string (YYYY-MM-DD)
    const getTodayStr = () => new Date().toISOString().split('T')[0];

    // Generate Initial Grid
    function renderGrid() {
        gridContainer.empty();
        for ( let i = 1; i <= TOTAL_NUMBERS; i++ ) {
            const numDiv = $('<div class="llnc-number"></div>')
                .text(i)
                .attr('data-number', i)
                .attr('id', 'num-' + i);
            gridContainer.append(numDiv);
        }
    }
    renderGrid();

    // Listen for Real-time Updates from Firebase
    db.collection("lucky_numbers")
      .where("date", "==", getTodayStr())
      .onSnapshot((querySnapshot) => {
          // Reset all to available first (in case of a day reset)
          $('.llnc-number').removeClass('taken').removeAttr('title');
          
          querySnapshot.forEach((doc) => {
              const data = doc.data();
              const num = data.lucky_number;
              $('#num-' + num).addClass('taken').attr('title', 'Already taken today');
          });
      });

    // Handle Click
    gridContainer.on('click', '.llnc-number', function() {
        const $this = $(this);
        if ( $this.hasClass('taken') ) {
            return; // Ignore if taken
        }

        const selectedNumber = $this.data('number');
        inputNumber.val(selectedNumber);
        displaySelectedNumber.text('#' + selectedNumber);
        
        form[0].reset();
        messages.hide().removeClass('error success').text('');
        modal.fadeIn(200);
    });

    // Close Handlers
    closeBtn.on('click', function() {
        modal.fadeOut(200);
    });

    $(window).on('click', function(event) {
        if ( $(event.target).is(modal) ) {
            modal.fadeOut(200);
        }
    });

    // Form Submission
    form.on('submit', async function(e) {
        e.preventDefault();
        
        const customerName = $('#llnc_customer_name').val();
        const phoneNumber = $('#llnc_phone_number').val();
        const invoiceNumber = $('#llnc_invoice_number').val();
        const luckyNumber = parseInt(inputNumber.val(), 10);
        
        if ( ! /^07\d{8}$/.test(phoneNumber) ) {
            showMessage('error', 'Please enter a valid Jordanian phone number starting with 07 and 10 digits long.');
            return;
        }

        submitBtn.prop('disabled', true).text('Processing...');
        messages.hide();

        try {
            // Check if phone or invoice already used today
            const phoneCheck = await db.collection("lucky_numbers")
                .where("date", "==", getTodayStr())
                .where("phone_number", "==", phoneNumber).get();
            
            if (!phoneCheck.empty) {
                showMessage('error', 'This phone number has already been used today.');
                submitBtn.prop('disabled', false).text('Secure My Number');
                return;
            }

            const invoiceCheck = await db.collection("lucky_numbers")
                .where("date", "==", getTodayStr())
                .where("invoice_number", "==", invoiceNumber).get();
            
            if (!invoiceCheck.empty) {
                showMessage('error', 'This invoice number has already been used today.');
                submitBtn.prop('disabled', false).text('Secure My Number');
                return;
            }

            // Check if number itself is taken (Race condition prevention)
            const docRef = db.collection("lucky_numbers").doc(`${getTodayStr()}_${luckyNumber}`);
            
            // Run transaction to ensure atomicity
            await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(docRef);
                if (doc.exists) {
                    throw "Number taken";
                }
                transaction.set(docRef, {
                    date: getTodayStr(),
                    lucky_number: luckyNumber,
                    customer_name: customerName,
                    phone_number: phoneNumber,
                    invoice_number: invoiceNumber,
                    created_at: firebase.firestore.FieldValue.serverTimestamp()
                });
            });

            showMessage('success', 'Your number #' + luckyNumber + ' has been successfully reserved!');
            setTimeout(function() {
                modal.fadeOut(200);
                submitBtn.prop('disabled', false).text('Secure My Number');
            }, 2000);

        } catch (error) {
            console.error(error);
            if (error === "Number taken") {
                showMessage('error', 'Sorry, this number was just taken! Please select another.');
            } else {
                showMessage('error', 'An error occurred. Please try again.');
            }
            submitBtn.prop('disabled', false).text('Secure My Number');
        }
    });

    function showMessage(type, text) {
        messages.removeClass('error success').addClass(type).text(text).fadeIn();
    }

    // Admin Reset
    $('#admin-reset-btn').on('click', async function() {
        const pass = $('#admin-pass').val();
        if(pass !== "123456") {
            alert("Incorrect password");
            return;
        }
        
        if(confirm("Are you sure you want to clear all numbers for today? This cannot be undone.")) {
            try {
                const snapshot = await db.collection("lucky_numbers").where("date", "==", getTodayStr()).get();
                const batch = db.batch();
                snapshot.docs.forEach((doc) => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
                alert("Reset successful.");
            } catch(e) {
                alert("Error resetting: " + e.message);
            }
        }
    });
});
