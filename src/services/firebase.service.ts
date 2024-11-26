import { Inject, Injectable } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class FirebaseService {
  private readonly apiUrl =
    'https://useful-tools-api-default-rtdb.firebaseio.com';

  constructor(
    private readonly httpService: HttpService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  getAllEvents(): Observable<any> {
    return this.httpService
      .get<any>(`${this.apiUrl}/events.json`)
      .pipe(map((resData) => resData.data));
  }
}
