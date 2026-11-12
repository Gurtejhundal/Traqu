from io import BytesIO
import base64
from uuid import uuid4
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def owner():
    return {'X-Local-User-Id': 'studio_' + uuid4().hex}

def picture(size=(256,256)):
    out=BytesIO(); Image.new('RGB',size,'white').save(out,format='JPEG')
    return 'data:image/jpeg;base64,'+base64.b64encode(out.getvalue()).decode()

def test_photo_customization_is_private_persistent_and_exported_in_backup():
    headers=owner(); other=owner()
    initial=client.get('/profile',headers=headers).json()
    assert initial['avatar']=='' and initial['weekly_goal']==5
    settings={**initial,'name':'Alex','avatar':picture(),'avatar_shape':'rounded','avatar_monochrome':False,'cover':'ink','calendar_palette':'slate','weekly_goal':3,'return_note':'Ten minutes counts.'}
    response=client.put('/profile',headers=headers,json=settings)
    assert response.status_code==200, response.text
    assert client.get('/profile',headers=headers).json()==settings
    assert client.get('/profile',headers=other).json()['avatar']==''
    import activity
    backup=activity.export(headers['X-Local-User-Id'])
    assert activity.validate_backup(backup)['profile']==settings

@pytest.mark.parametrize('value',['https://example.com/photo.png','data:image/svg+xml;base64,PHN2Zy8+','data:image/jpeg;base64,invalid','data:image/png;base64,YWJj'])
def test_profile_rejects_external_or_invalid_photo_without_changing_profile(value):
    headers=owner()
    assert client.put('/profile',headers=headers,json={'name':'Alex','avatar':value}).status_code==422
    assert client.get('/profile',headers=headers).json()['avatar']==''

def test_profile_rejects_huge_image_dimensions_and_invalid_choices():
    headers=owner()
    for payload in [{'avatar':picture((1025,1))},{'weekly_goal':0},{'weekly_goal':8},{'cover':'arbitrary'},{'calendar_palette':'unknown'},{'avatar_shape':'unknown'}]:
        assert client.put('/profile',headers=headers,json=payload).status_code==422
    assert client.put('/profile',headers=headers,json={'name':'Alex','avatar':picture()}).status_code==200
    assert client.put('/profile',headers=headers,json={'name':'Alex','avatar':''}).json()['avatar']==''

def test_recent_activity_always_has_seven_dates_even_when_viewing_old_year():
    data=client.get('/activity?timezone=Asia%2FKolkata&year=2000',headers=owner()).json()
    assert len(data['recent_days'])==7 and data['recent_days'][-1]['date']==data['today']
    assert all(d['count']==0 for d in data['recent_days'])
    assert data['days']==[]

def test_setup_and_notification_preferences_validate_and_survive_backup():
    headers = owner()
    initial = client.get('/profile', headers=headers).json()
    assert initial['onboarding_completed'] is False and initial['desktop_notifications'] is False
    settings = {**initial, 'onboarding_completed': True, 'interests': ['Coding', 'Career'], 'reminder_enabled': True, 'reminder_time': '08:30', 'desktop_notifications': True, 'notifications_seen': ['ai-connection', 'daily-2026-11-12']}
    response = client.put('/profile', headers=headers, json=settings)
    assert response.status_code == 200 and response.json() == settings
    import activity
    assert activity.validate_backup(activity.export(headers['X-Local-User-Id']))['profile'] == settings
    for invalid in [{'reminder_time': '25:00'}, {'interests': ['Anything']}, {'notifications_seen': ['arbitrary-url']}, {'notifications_seen': ['ai-connection'] * 41}]:
        assert client.put('/profile', headers=headers, json={**settings, **invalid}).status_code == 422
    assert client.get('/profile', headers=headers).json() == settings

def test_default_setup_profile_does_not_block_recovery_but_custom_profile_is_preserved():
    import activity
    source = owner()
    client.put('/profile', headers=source, json={'name': 'Recovered learner', 'interests': ['Coding']})
    backup = client.get('/backup', headers=source).json()
    import json
    for name in ['Your workspace', 'Keep my profile']:
        target = owner()
        client.put('/profile', headers=target, json={'name': name, 'onboarding_completed': True, 'notifications_seen': ['ai-connection']})
        result = client.post('/backup/restore-file', headers=target, files={'file': ('backup.json', json.dumps(backup).encode(), 'application/json')})
        assert result.status_code == 200, result.text
        profile = client.get('/profile', headers=target).json()
        assert profile['name'] == ('Recovered learner' if name == 'Your workspace' else name)
        assert profile['onboarding_completed'] is True
