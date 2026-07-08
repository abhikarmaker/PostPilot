# PostPilot

Project: Social Media Recurring Post Scheduler (Meta Graph API)

Goal

Build a feature that allows businesses to upload a Facebook or Instagram post/Reel once and automatically republish the same content on a recurring schedule (e.g., weekly, monthly).

Platforms

* Facebook Pages
* Instagram Professional (Business/Creator) accounts
* Future expansion: LinkedIn, X, YouTube, TikTok (where APIs permit)

APIs

* Meta Graph API
* Facebook Pages API
* Instagram Graph API

Requirements

* Meta Developer App
* Facebook Page
* Instagram Professional Account linked to the Facebook Page
* Page Access Token (preferably long-lived)
* Required Graph API permissions for publishing

Core Features

* Connect Facebook and Instagram accounts
* Upload image/video/Reel
* Store caption and hashtags
* Select platforms (Facebook, Instagram, or both)
* Schedule:
    * One-time
    * Daily
    * Weekly
    * Bi-weekly
    * Monthly
    * Custom recurrence
* Pause / Resume schedules
* Edit scheduled content
* Delete schedules
* Posting history and logs

System Architecture

Frontend

* Upload media
* Compose caption
* Configure schedule
* Manage connected accounts

Backend

* Authentication
* Store media metadata
* Store schedule configuration
* Scheduler service
* Graph API integration
* Retry and error handling

Database Tables

* Users
* Social Accounts
* Posts
* Media
* Schedules
* Publish History

Scheduler Flow

1. User uploads content.
2. Save media, caption, hashtags, and recurrence rule.
3. Scheduler runs periodically.
4. Find posts due for publishing.
5. Call the Meta Graph API.
6. Record success or failure.
7. Calculate and save the next run time.

Notes

* The Meta Graph API publishes new posts; it does not “repost” an existing Facebook post by ID.
* Each scheduled run creates a new Facebook or Instagram post using the stored content.
* The Graph API is free to use.
* Only advertising campaigns incur Meta charges.

Future Enhancements

* AI-generated captions
* AI hashtag suggestions
* Auto image resizing
* Content approval workflow
* Multi-client support
* Team permissions
* Analytics dashboard
* Cross-platform publishing
* Bulk scheduling
* Time zone support
* Webhooks and notifications

Suggested Technology Stack

Frontend

* React / Next.js

Backend

* Node.js + Express or NestJS

Database

* PostgreSQL

Queue / Scheduler

* BullMQ + Redis
    or
* Cron jobs / Cloud Scheduler

Storage

* AWS S3 or Cloudflare R2

Authentication

* Meta OAuth

Deployment

* Docker
* AWS / Azure / Google Cloud / DigitalOcean

Long-Term Vision

Develop a unified social media automation platform where businesses can connect multiple social networks, upload content once, schedule recurring posts, and manage publishing from a single dashboard.

This summary should be enough to pick the project back up later. When you’re ready, I can help you design the database, API endpoints, scheduler, and Meta integration step by step.