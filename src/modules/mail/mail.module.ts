import {Global,Module } from '@nestjs/common';
import {MailService } from './mail.service';
@Global() //make this module accessible to all other modules  
@Module({
    providers: [MailService],// setting the service classes for this module
    exports:[MailService],//allow the mailservice to be accessed from another modules
})
export class MailModule {} // the mail module class