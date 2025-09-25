# Project: Agoda-like Booking App

## Project Description
This project is a full-featured booking platform similar to Agoda, designed to allow customers to search, browse, and book guesthouse rooms online.

## Tech Stack
- Backend: Node.js, Express.js
- Database: MongoDB
- Tools: Postman, JWT, Mongoose

## Types of Users
1. **Master Admin (Super Admin – Backend Web Portal)**  
   - Controls entire platform: guesthouses, customers, bookings, payments  
2. **Guest House Admin (Hotel/Guesthouse Owners – Mobile App + Web Option)**  
   - Manages their own property, rooms, and bookings  
3. **Customers (End Users – Mobile App + Website)**  
   - Browse and book rooms

## Basic Flow
1. Guesthouse Onboarding → Registers on app → Master admin approves  
2. Room Listing → Guesthouse uploads room details & availability  
3. Customer Browsing → Searches rooms on app/website  
4. Booking & Payment → Customer books → Payment collected → Guesthouse notified  
5. Admin Control → Master admin monitors transactions, guesthouses, and customer activity
