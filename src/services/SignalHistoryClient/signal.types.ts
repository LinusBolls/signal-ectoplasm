type Uuid = string

type UnixTimestampMillisecs = number

// i.e. "+4917642004388"
type PhoneNr = string

type SpaceSeperatedUuids = string

// conversations between you and exactly one other member, or "note to self"
export interface PrivateConversation {
  id: Uuid
  json: `{"unreadCount":0,"verified":1,"messageCount":14,"sentMessageCount":13,"id":"05407796-ca90-412d-8f92-1c4c07778eb6","uuid":"d943657e-2caa-46a8-b085-c344a6074228","e164":"+4917642004388","type":"private","version":2,"pni":"065696c5-95cc-4f8b-9ad8-9756784ab854","sealedSender":1,"color":"A160","profileKeyCredential":"ACiGnR+BXMSOI9od80AHSjmkYujsRk+UgUD6yiIC40YEeBug4XHDyMGrsunu20uVMDMc3jaNeH56zbvEv8HWtjf+UTJKQthy6UR0kR1pPIYhnuaqTQlspyqI8wMZRt6ZQ9lDZX4sqkaosIXDRKYHQijJZOPJ46uevIXI7ufLZq/sQ7oMCImkOfmghuJKxyLVHoD1UmQAAAAA","profileKeyCredentialExpiration":1683158400000,"accessKey":"9WyPIvHoP2jy3sXbxIIIBQ==","profileKey":"yWTjyeOrnryFyO7ny2av7EO6DAiJpDn5oIbiSsci1R4=","needsStorageServiceSync":false,"about":"there's no place like 127.0.0.1","capabilities":{"gv1-migration":true,"senderKey":true,"announcementGroup":true,"changeNumber":true,"stories":true,"giftBadges":true,"paymentActivation":false,"pni":false},"profileName":"Linus","profileAvatar":{"hash":"zoM30Pev8nNQfaBmkm1k1WH4HDTlFf14EfA4a81L72XMD9iuEO8vES0QyGnfM+8aoncPaJGOPlScKl2d9MrK4Q==","path":"2f/2fcc6fd8d830d77018a35bd42e2f637868df5bb63906eba130eced67e92a56ef"},"lastProfile":{"profileKey":"yWTjyeOrnryFyO7ny2av7EO6DAiJpDn5oIbiSsci1R4=","profileKeyVersion":"9866d79ec1c162628fd23c82351cd768eba1621fd74b75358399acfe053662da"},"messageCountBeforeMessageRequests":0,"inbox_position":4,"avatar":null,"storageUnknownFields":"ggEA+AEB","isArchived":false,"markedUnread":false,"username":"","storageID":"gPEibiuEYVcwS9EtsT2DGQ==","storageVersion":1987,"lastMessage":"Photo","lastMessageBodyRanges":[],"lastMessageAuthor":"You","lastMessageStatus":"viewed","timestamp":1683057944220,"draftAttachments":[],"draftChanged":false,"draft":"","draftBodyRanges":[],"draftTimestamp":null,"profileSharing":true,"active_at":1683057944220,"lastMessagePrefix":"📷"}`,
  active_at: UnixTimestampMillisecs | null // null for people without read receipts
  type: "private"
  members: null
  name: string | null // null if "note to self"
  profileName: string // probably nullable
  profileFamilyName: string | null
  profileFullName: string // probably nullable
  e164: PhoneNr,
  uuid: Uuid, // the user id of the other member
  groupId: null,
  profileLastFetchedAt: UnixTimestampMillisecs
}
export interface GroupConversation {
  id: Uuid,
  json: '{"unreadCount":0,"verified":0,"messageCount":51,"sentMessageCount":6,"id":"d093e0ac-5e92-40b3-92ab-5666d59ece9e","groupId":"CL16InD3BN8Es1lx+2RMSnZUNXo7XwJYMD2OYt6N0KI=","type":"group","version":2,"groupVersion":2,"masterKey":"EIbPqIRCbh+2P81BNLjg3vgpAwfMlM9sPVNR2Hv57EY=","secretParams":"ABCGz6iEQm4ftj/NQTS44N74KQMHzJTPbD1TUdh7+exGCL16InD3BN8Es1lx+2RMSnZUNXo7XwJYMD2OYt6N0KIMnDOMts37meBq28GESqWofl90sjn5D8rZVJRS2uN49NYABkejmcAbt6Bl9912WKN1TJ85zB3e1lAqwg+swCENuTifydiYDRXCPT0XgaDEA+AFU6078JbTEBNavaDZHgA89bKiUUn/rLiKpeZ9SPg+Tpe23LGxk1xE8UfYfNDFNeR5F8w1cpDTQ8thxLx8++p5xBAi27zCvYEV5HMznkkBNZwhisbX0BN7As+PF7eW0NWHrJ3yPNxp+kddm8t36Qos8MvQWAikKW1F2HcghlB90SteLDzRcSDj6tuoh411bg==","publicParams":"AAi9eiJw9wTfBLNZcftkTEp2VDV6O18CWDA9jmLejdCiPPWyolFJ/6y4iqXmfUj4Pk6XttyxsZNcRPFH2HzQxTUs8MvQWAikKW1F2HcghlB90SteLDzRcSDj6tuoh411bg==","sealedSender":0,"color":"A180","hideStory":false,"isArchived":false,"markedUnread":false,"dontNotifyForMentionsIfMuted":false,"storageID":"Q+FWX6/IW/3JqatjwT1M/g==","storageVersion":1968,"storySendMode":"IfActive","muteExpiresAt":0,"messageRequestResponseType":1,"profileSharing":true,"revision":18,"name":"::1","avatar":{"url":"groups/CL16InD3BN8Es1lx-2RMSnZUNXo7XwJYMD2OYt6N0KI/0ZvOM0YjX-GITdgDX9l6Eg","path":"16/168e920478ec93be74a252e3e2414207f90acf4bf1bf5daf126ef2d387311ece","hash":"4yZTtzZs0xQQPN3M9hSVSiOpqhzFzKuShl+RPSGqp1x4F/Fs18Wu/09g5280rwxXV05g4EpEBCsOzE22/d8sIA=="},"accessControl":{"attributes":2,"members":2,"addFromInviteLink":4},"left":false,"membersV2":[{"role":2,"joinedAtVersion":18,"uuid":"d61b7036-0e60-42d7-b03b-9adfe85eafc5"},{"role":2,"joinedAtVersion":18,"uuid":"cb922b31-e6a3-4052-beb6-f6d5b880131d"},{"role":2,"joinedAtVersion":18,"uuid":"d943657e-2caa-46a8-b085-c344a6074228"},{"role":1,"joinedAtVersion":7,"uuid":"10fd0d18-115c-427d-9616-ded1d31cfc6c"},{"role":1,"joinedAtVersion":8,"uuid":"2332a142-b147-400f-9008-ba792fa751ff"},{"role":1,"joinedAtVersion":18,"uuid":"83e35908-7d1d-4493-9cc5-a3222867dde0"}],"pendingMembersV2":[{"addedByUserId":"d943657e-2caa-46a8-b085-c344a6074228","uuid":"cd8ffed7-caed-46d9-9f95-04d78a5f1e1d","timestamp":1677778277167,"role":1}],"pendingAdminApprovalV2":[],"description":"","announcementsOnly":false,"bannedMembersV2":[],"active_at":1683061395873,"lastMessage":"Also wenn actually 6€ espresso martini oder so ist echt guter preis","lastMessageBodyRanges":[],"lastMessageAuthor":"Lennart","lastMessageStatus":null,"timestamp":1683061395493,"draft":"","draftBodyRanges":[],"draftChanged":false,"draftTimestamp":null,"senderKeyInfo":{"createdAtDate":1682079037074,"distributionId":"b36a8de8-072e-4a27-a8db-7af2346ab000","memberDevices":[{"identifier":"cb922b31-e6a3-4052-beb6-f6d5b880131d","id":4,"registrationId":10366},{"identifier":"2332a142-b147-400f-9008-ba792fa751ff","id":1,"registrationId":8888},{"identifier":"cb922b31-e6a3-4052-beb6-f6d5b880131d","id":1,"registrationId":2201},{"identifier":"10fd0d18-115c-427d-9616-ded1d31cfc6c","id":2,"registrationId":80},{"identifier":"10fd0d18-115c-427d-9616-ded1d31cfc6c","id":1,"registrationId":9749},{"identifier":"83e35908-7d1d-4493-9cc5-a3222867dde0","id":1,"registrationId":16357},{"identifier":"d61b7036-0e60-42d7-b03b-9adfe85eafc5","id":1,"registrationId":4604},{"identifier":"d61b7036-0e60-42d7-b03b-9adfe85eafc5","id":3,"registrationId":15263},{"identifier":"d61b7036-0e60-42d7-b03b-9adfe85eafc5","id":9,"registrationId":4825}]},"draftAttachments":[]}',
  active_at: UnixTimestampMillisecs
  type: "group",
  members: SpaceSeperatedUuids
  name: string
  profileName: null
  profileFamilyName: null
  profileFullName: null
  e164: null
  uuid: null
  groupId: string // not a uuid
  profileLastFetchedAt: null
}
export type Conversation = PrivateConversation | GroupConversation

export interface TextMessage {
  rowid: number
  id: Uuid
  json: '{"timestamp":1682005525900,"attachments":[],"id":"83daabbc-e7d8-45ef-ae53-3e4a83003e1b","conversationId":"4d6cafc8-1863-40d6-9a60-b8453d407a9c","readStatus":0,"received_at":132,"received_at_ms":1682005527400,"seenStatus":2,"sent_at":1682005525900,"serverGuid":"de1ae312-a143-45c2-9067-b8d4e37eb385","serverTimestamp":1682005526036,"source":"+4915732703514","sourceDevice":2,"sourceUuid":"10fd0d18-115c-427d-9616-ded1d31cfc6c","type":"incoming","unidentifiedDeliveryReceived":true,"schemaVersion":10,"body":"https://github.com/leptos-rs/leptos","bodyRanges":[],"contact":[],"decrypted_at":1682005527742,"errors":[],"flags":0,"hasAttachments":0,"isViewOnce":false,"preview":[],"requiredProtocolVersion":0,"supportedVersionAtReceive":7}',
  readStatus: 0
  expires_at: null
  sent_at: UnixTimestampMillisecs
  schemaVersion: 10,
  conversationId: Uuid
  received_at: number // three digits
  source: UnixTimestampMillisecs
  hasAttachments: 0
  hasFileAttachments: 0
  hasVisualMediaAttachments: 0
  expireTimer: null
  expirationStartTimestamp: null
  type: "incoming" | "outgoing"
  body: string
  messageTimer: null,
  messageTimerStart: null,
  messageTimerExpiresAt: null,
  isErased: 0,
  isViewOnce: 0,
  sourceUuid: Uuid, // the id of the user that sent the message
  serverGuid: Uuid
  sourceDevice: 2,
  storyId: null,
  isStory: 0,
  isChangeCreatedByUs: 0,
  isTimerChangeFromSync: 0,
  isGroupLeaveEvent: 0,
  isGroupLeaveEventFromOther: 0,
  seenStatus: 2,
  storyDistributionListId: null,
  callId: null,
  callMode: null,
  expiresAt: UnixTimestampMillisecs
  shouldAffectActivity: 1,
  shouldAffectPreview: 1,
  isUserInitiatedMessage: 1
}
export type Message = TextMessage

export interface PrivateMessageJson {
  "unreadCount": 0,
  "verified": 0,
  "messageCount": 0,
  "sentMessageCount": 0,
  "id": "c4a2cdee-2b42-4f2c-9bd7-5a63efb13dde",
  "uuid": "c46b4036-4e2e-4740-b8d0-2f35f1a3a934",
  "e164": "+4368110320197",
  "type": "private",
  "version": 2,
  "sealedSender": 1,
  "color": "A100",
  "name": "Janens",
  "inbox_position": 34,
  "avatar": null,
  "profileKeyCredential": "AJxRgwgbir7kTUfbOszJNNfvB/WCu1I68sruMvQE5b4F5FWYOcR6xlQRVNg2AVufYdFGqmE8a+sn+KIonHhB017KtA0KWB+TX9bXkakGuHWt31xlQxqEBIO6JQxWB5DSF8RrQDZOLkdAuNAvNfGjqTTwoRJBJw/DTd2ld1OzbhC+yY8tdBVnTY5GWV9mjQFWdwC7SWQAAAAA",
  "profileKeyCredentialExpiration": 1682553600000,
  "accessKey": "BG0y9p/oyKBoNItHlkwKzw==",
  "profileKey": "8KESQScPw03dpXdTs24QvsmPLXQVZ02ORllfZo0BVnc=",
  "profileName": "Jannis",
  "systemGivenName": "Janens",
  "messageRequestResponseType": 1,
  "profileSharing": true,
  "hideStory": false,
  "isArchived": false,
  "markedUnread": false,
  "storageID": "U0o/HeBUP4VxC+TK0Ue8fw==",
  "storageVersion": 1998,
  "muteExpiresAt": 0,
  "capabilities": {
    "gv1-migration": true,
    "senderKey": true,
    "announcementGroup": true,
    "changeNumber": true,
    "stories": false,
    "giftBadges": true,
    "paymentActivation": false,
    "pni": false
  },
  "profileAvatar": {
    "hash": "XzEshAT4/HcxK2jrX/p5nmibTzFL9vC14rY7edu42lH8kGcmDDhyc9DNxA7WKiZpmBQI+8yz8dOd8pZvHQN/nQ==",
    "path": "d9/d9d9c375c2ea6d877b7a91bd09e071cd5d130cd5769e2deb593f5a621ff8f3f4"
  },
  "lastProfile": {
    "profileKey": "8KESQScPw03dpXdTs24QvsmPLXQVZ02ORllfZo0BVnc=",
    "profileKeyVersion": "221afcf78aea3d375e4c9beb0f5cfc211cbee9630428c67a1eea17711f56efbd"
  }
}

export interface GroupMessageJson {
  "timestamp": 1683062910676,
  "attachments": [],
  "id": "1d58b5da-058e-40e2-86c5-201d050f9a5b",
  "type": "outgoing",
  "body": "hast aber auch nen run gerade",
  "conversationId": "63ef615b-0062-45b8-8b69-f505e0d79fd5",
  "contact": [],
  "preview": [],
  "sent_at": 1683062910676,
  "received_at": 7493,
  "received_at_ms": 1683062910676,
  "expirationStartTimestamp": 1683062910958,
  "expireTimer": 0,
  "readStatus": 0,
  "seenStatus": 0,
  "bodyRanges": [],
  "sendHQImages": false,
  "sendStateByConversationId": {
    "be996be5-4473-4554-baa0-dedfd0620bb4": {
      "status": "Delivered",
      "updatedAt": 1683062915330
    },
    "0fab43ba-a7ba-4e37-9ccd-b22a5a2126b2": {
      "status": "Read",
      "updatedAt": 1683062950119
    },
    "c43a75a1-2845-45f2-94ff-4b5033c77d00": {
      "status": "Read",
      "updatedAt": 1683062967716
    },
    "735b3dac-d91f-4f9b-826b-09e1cc9c561a": {
      "status": "Read",
      "updatedAt": 1683062948839
    },
    "f2af2c08-11f1-4cce-9bed-68b6a4cef311": {
      "status": "Read",
      "updatedAt": 1683064123666
    },
    "86f49215-2428-4fe0-b27c-4422f73644e8": {
      "status": "Delivered",
      "updatedAt": 1683062913195
    },
    "ed458c9a-78e8-44d9-a6f4-c57b4e25be2f": {
      "status": "Read",
      "updatedAt": 1683063307850
    },
    "343d07c1-3fad-4842-bf42-6c4d8dcc690e": {
      "status": "Sent",
      "updatedAt": 1683062910958
    },
    "74c052fb-a292-40b0-96a1-e6413a558132": {
      "status": "Sent",
      "updatedAt": 1683062910958
    },
    "2ddae5fb-72f5-4b4d-908f-9f9c421e0fac": {
      "status": "Read",
      "updatedAt": 1683062924733
    },
    "a4651ea8-d927-46b0-b350-0e603bec5684": {
      "status": "Sent",
      "updatedAt": 1683062910958
    },
    "9da46f20-6b96-48d5-a66a-fe904747c0f5": {
      "status": "Read",
      "updatedAt": 1683070389066
    },
    "965c096a-eadc-4d93-9a7e-002dfc455740": {
      "status": "Delivered",
      "updatedAt": 1683062913822
    },
    "651cc494-a82b-4dc3-9031-36982b0029b9": {
      "status": "Sent",
      "updatedAt": 1683062910958
    },
    "4d6cafc8-1863-40d6-9a60-b8453d407a9c": {
      "status": "Delivered",
      "updatedAt": 1683062911864
    },
    "58d43163-28cb-47a2-80c4-df1678e61b90": {
      "status": "Delivered",
      "updatedAt": 1683062913287
    },
    "8195fc8e-c5c4-4b28-a5b6-4b1e6017314c": {
      "status": "Delivered",
      "updatedAt": 1683062911761
    },
    "96715bd0-272c-4a2c-9017-79e427a76c34": {
      "status": "Read",
      "updatedAt": 1683067133079
    },
    "52591ea1-9820-487e-8dfb-74ef0418a25d": {
      "status": "Delivered",
      "updatedAt": 1683062912492
    },
    "60e8293c-86e9-42a7-80bf-0f7806acc9a7": {
      "status": "Sent",
      "updatedAt": 1683062910958
    },
    "202b2043-76d6-442a-8793-62ca342b6fa2": {
      "status": "Read",
      "updatedAt": 1683063002810
    },
    "05407796-ca90-412d-8f92-1c4c07778eb6": {
      "status": "Sent",
      "updatedAt": 1683062911165
    }
  },
  "schemaVersion": 10,
  "hasAttachments": 0,
  "unidentifiedDeliveries": [
    "eb9ec737-41f3-459b-9a35-7d194bc20c6d",
    "80ac8a6f-f95b-4e35-9b5a-d2405cf6b789",
    "5f5404b0-2202-4a6b-b51e-556764a45c5f",
    "b95ce4c5-6c8c-4951-bca8-8da0afef0b82",
    "862ae433-4458-4d95-8096-ec6f64f6b570",
    "85d0dc28-ea6b-450d-8f35-47bfef806242",
    "10fd0d18-115c-427d-9616-ded1d31cfc6c",
    "29aa70f7-4961-48f4-bf47-376967146566",
    "a7c9e63f-01a6-4016-88cf-25e6a632930c",
    "364789a3-adca-4cc3-b2af-5fac80ef83cf",
    "c5c6b759-07f2-45ac-9262-8ebf45ed1f35",
    "2332a142-b147-400f-9008-ba792fa751ff",
    "777d783e-3471-4e3a-9dfe-81ff72b41cb6",
    "651cd571-b2cb-4d98-a34a-539c8ef62740",
    "12a33d94-382f-4d4a-9a92-339d73df8d9c",
    "f41f8f71-4a30-49a2-af6c-acf2e62bc5cb",
    "90d399da-f9c4-4f6f-b3cc-2bb3a9590911",
    "d1e3293b-2662-435f-b06c-c069f9a7a6dd",
    "df20e0f0-21eb-4dc9-a688-b2a037e4a191",
    "d6192cc2-975c-4551-b331-2717fcec75f5",
    "cb922b31-e6a3-4052-beb6-f6d5b880131d"
  ],
  "errors": [],
  "synced": true,
  "reactions": [
    {
      "emoji": "🏃",
      "fromId": "c43a75a1-2845-45f2-94ff-4b5033c77d00",
      "targetAuthorUuid": "d943657e-2caa-46a8-b085-c344a6074228",
      "targetTimestamp": 1683062910676,
      "timestamp": 1683063010821
    },
    {
      "emoji": "👟",
      "fromId": "05407796-ca90-412d-8f92-1c4c07778eb6",
      "targetAuthorUuid": "d943657e-2caa-46a8-b085-c344a6074228",
      "targetTimestamp": 1683062910676,
      "timestamp": 1683063107057
    },
    {
      "emoji": "🤝",
      "fromId": "2ddae5fb-72f5-4b4d-908f-9f9c421e0fac",
      "targetAuthorUuid": "d943657e-2caa-46a8-b085-c344a6074228",
      "targetTimestamp": 1683062910676,
      "timestamp": 1683063566132
    }
  ]
}