import { Address, ipfs, json } from "@graphprotocol/graph-ts";
import {
  ConfirmedAttendee,
  DepositsPaidOut,
  NewEventCreated,
  NewRSVP
} from "../generated/Web3Rsvp/Web3Rsvp";
import { Account, RSVP, Confirmation, Event } from "../generated/schema";
import { integer } from "@protofire/subgraph-toolkit";

export function handleNewEventCreated(event: NewEventCreated): void {
  // Because we have an eventID already from the NewEventCreated event, 
  // we can use this as the unique id for the Event entity. 
  // We also want to make sure that we don’t create any duplicate events with the same id, 
  // so we can try to load this event first, and if it isn’t found, 
  // we can create it and save it. (Note: If you forget to use the save method at the end of your function, 
  // this data won’t save! Always make sure you are saving any changes made to an entity).

  // Because the eventID emitted from our contract is of the type Bytes32, 
  // we can use the built-in method toHex() to convert the id to a hexadecimal string representing the bytes in the array.
  let newEvent = Event.load(event.params.eventID.toHex());
  if (newEvent == null) {
    newEvent = new Event(event.params.eventID.toHex());
    newEvent.eventID = event.params.eventID;
    newEvent.eventOwner = event.params.creatorAddress;
    newEvent.eventTimestamp = event.params.eventTimestamp;
    newEvent.maxCapacity = event.params.maxCapacity;
    newEvent.deposit = event.params.deposit;
    newEvent.paidOut = false;
    newEvent.totalRSVPs = integer.ZERO;
    newEvent.totalConfirmedAttendees = integer.ZERO;

    // For the totalRSVPs and totalConfirmedAttendees fields, 
    // we will be using the protofire subgraph toolkit we added earlier. 
    // In our handleNewEventCreated function, we want to set the totals to 0 to start, 
    // so we can use integer.ZERO to set these fields to 0.

    let metadata = ipfs.cat(event.params.eventDataCID + "/data.json");

    // For the name, description, link, and imagePath fields, 
    // we will be using the eventCID to access data stored with ipfs (web3.storage). 
    // We can use the CID and the name of the event details file, data.json, to pull this data in.

    if (metadata) {
      const value = json.fromBytes(metadata).toObject();
      if (value) {
        const name = value.get("name");
        const description = value.get("description");
        const link = value.get("link");
        const imagePath = value.get("image");
    
        if (name) {
          newEvent.name = name.toString();
        }
    
        if (description) {
          newEvent.description = description.toString();
        }
    
        if (link) {
          newEvent.link = link.toString();
        }
    
        if (imagePath) {
          const imageURL =
            "https://ipfs.io/ipfs/" +
            event.params.eventDataCID +
            imagePath.toString();
          newEvent.imageURL = imageURL;
        } else {
          // return fallback image if no imagePath
          const fallbackURL =
            "https://ipfs.io/ipfs/bafybeibssbrlptcefbqfh4vpw2wlmqfj2kgxt3nil4yujxbmdznau3t5wi/event.png";
          newEvent.imageURL = fallbackURL;
        }
      }
    }

    newEvent.save();
  }
  // This is a standard pattern we will follow for each of our mapping functions. 
  // We will first check to see if we can load our entity with a unique id, and create a new instance only if that result is null.
}

function getOrCreateAccount(address: Address): Account {
  let account = Account.load(address.toHex());
  if (account == null) {
    account = new Account(address.toHex());
    account.totalRSVPs = integer.ZERO;
    account.totalAttendedEvents = integer.ZERO;
    account.save();
  }
  return account;
}

export function handleNewRSVP(event: NewRSVP): void {
  let id = event.params.eventID.toHex() + event.params.attendeeAddress.toHex();
  let newRSVP = RSVP.load(id);
  let account = getOrCreateAccount(event.params.attendeeAddress);
  let thisEvent = Event.load(event.params.eventID.toHex());
  if (newRSVP == null && thisEvent != null) {
    newRSVP = new RSVP(id);
    newRSVP.attendee = account.id;
    newRSVP.event = thisEvent.id;
    newRSVP.save();
    thisEvent.totalRSVPs = integer.increment(thisEvent.totalRSVPs);
    thisEvent.save();
    account.totalRSVPs = integer.increment(account.totalRSVPs);
    account.save();
  }
}

export function handleConfirmedAttendee(event: ConfirmedAttendee): void {
  let id = event.params.eventID.toHex() + event.params.attendeeAddress.toHex();
  let newConfirmation = Confirmation.load(id);
  let account = getOrCreateAccount(event.params.attendeeAddress);
  let thisEvent = Event.load(event.params.eventID.toHex());
  if (newConfirmation == null && thisEvent != null) {
    newConfirmation = new Confirmation(id);
    newConfirmation.attendee = account.id;
    newConfirmation.event = thisEvent.id;
    newConfirmation.save();

    thisEvent.totalConfirmedAttendees = integer.increment(
      thisEvent.totalConfirmedAttendees
    );
    thisEvent.save();

    account.totalAttendedEvents = integer.increment(
      account.totalAttendedEvents
    );
    account.save();
  }
}

export function handleDepositsPaidOut(event: DepositsPaidOut): void {
  let thisEvent = Event.load(event.params.eventID.toHex());
  if (thisEvent) {
    thisEvent.paidOut = true;
    thisEvent.save();
  }
}






// **notes
// Each function in our mapping must be exported, 
// and takes in the event it will handle as an argument.

// We can run graph codegen in the terminal to generate AssemblyScript types for our entities and events, 
// and import them at the top of our mappings file (make sure you are in the root directory of your project folder and have saved your changes before running this command). 
// With this you should also be able to easily see all of the properties of the event object in your code editor.