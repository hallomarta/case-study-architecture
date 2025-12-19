import { Application } from 'express';
import { getApp } from '../../src/lib/app';

export async function getTestApp(): Promise<Application> {
    return getApp();
}
