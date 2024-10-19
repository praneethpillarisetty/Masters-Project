import uuid
import atexit
from flask import Flask, render_template, request, redirect, url_for, jsonify, session, flash
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import event, or_
from sqlalchemy.engine import Engine
from sqlalchemy import cast, String, DateTime
from flask_login import UserMixin, LoginManager, login_user, logout_user, current_user, login_required
from apscheduler.schedulers.background import BackgroundScheduler
import firebase_admin
from firebase_admin import credentials, storage
import os
import json
import tempfile
import signal
import sys
from datetime import datetime, timedelta
from dateutil import parser
from hurry.filesize import size


cred = credentials.Certificate('serviceAccountKey.json')
firebase_admin.initialize_app(cred, {'storageBucket': 'masters-project-3673a.appspot.com'})

app = Flask(__name__)
scheduler = BackgroundScheduler()
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SECRET_KEY'] = 'your_secret_key'
app.config['UPLOAD_FOLDER'] = 'static/temp'
db = SQLAlchemy(app)


login_manager = LoginManager()
login_manager.init_app(app)

@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON;")
    cursor.close()

def remove_expired_records():
    now = datetime.utcnow()
    db.session.query(SharedWithMe).filter(SharedWithMe.expiration_date <= now).delete(synchronize_session=False)
    db.session.query(SharedByMe).filter(SharedByMe.expiration_date <= now).delete(synchronize_session=False)
    db.session.commit()


class User(UserMixin, db.Model):
    __tablename__ = "Users"
    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    public_key = db.Column(db.String(2000), nullable=False)

    recent_files = db.relationship('RecentFiles', backref='user', cascade='all, delete-orphan', passive_deletes=True)

class MetaData(db.Model):
    __tablename__ = "Meta_Data"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('Users.id'), nullable=False)
    description = db.Column(db.String(500))
    tags = db.Column(db.String(500))
    data_type = db.Column(db.String(50))
    hash_id = db.Column(db.String(500), unique=True)
    digital_signature = db.Column(db.String(500))
    encryption_key = db.Column(db.String(500))
    internal_url = db.Column(db.String(500))
    external_url = db.Column(db.String(500))
    shared_type = db.Column(db.String(50))
    file_size = db.Column(db.String(50))
    last_modified = db.Column(db.String(50))

    shared_with_me = db.relationship('SharedWithMe', backref='metadata', cascade='all, delete-orphan', passive_deletes=True)
    shared_by_me = db.relationship('SharedByMe', backref='metadata', cascade='all, delete-orphan', passive_deletes=True)
    recent_files = db.relationship('RecentFiles', backref='metadata', cascade='all, delete-orphan', passive_deletes=True)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'description': self.description,
            'tags': self.tags,
            'data_type': self.data_type,
            'hash_id': self.hash_id,
            'digital_signature': self.digital_signature,
            'encryption_key': self.encryption_key,
            'internal_url': self.internal_url,
            'external_url': self.external_url,
            'shared_type': self.shared_type,
            'file_size': self.file_size,
            'last_modified': self.last_modified
        }

class SharedWithMe(db.Model):
    __tablename__ = 'Shared_With_Me'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('Users.id', ondelete='CASCADE'), nullable=False)
    file_id = db.Column(db.Integer, db.ForeignKey('Meta_Data.id', ondelete='CASCADE'), nullable=False)
    encryption_key = db.Column(db.String(500))
    share_link = db.Column(db.String(500), unique=True, nullable=False)
    expiration_date = db.Column(db.DateTime, nullable=False)

class SharedByMe(db.Model):
    __tablename__ = 'Shared_By_Me'
    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey('Users.id', ondelete='CASCADE'), nullable=False)
    file_id = db.Column(db.Integer, db.ForeignKey('Meta_Data.id', ondelete='CASCADE'), nullable=False)
    shared_with_user_id = db.Column(db.Integer, db.ForeignKey('Users.id', ondelete='CASCADE'), nullable=False)
    share_link = db.Column(db.String(500), nullable=False)
    expiration_date = db.Column(db.DateTime, nullable=False)

class RecentFiles(db.Model):
    __tablename__ = 'Recent_Files'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('Users.id', ondelete='CASCADE'), nullable=False)
    file_id = db.Column(db.Integer, db.ForeignKey('Meta_Data.id', ondelete='CASCADE'), nullable=False)
    opened_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

def create_db():
    with app.app_context():
        db.create_all()

def download_db():
    bucket = storage.bucket()
    blob = bucket.blob('users.db')
    blob.download_to_filename('instance/users.db')

def upload_db():
    bucket = storage.bucket()
    blob = bucket.blob('users.db')
    blob.upload_from_filename('instance/users.db')

atexit.register(upload_db)
signal.signal(signal.SIGINT, lambda sig, frame: (upload_db(), sys.exit(0)))

def start_scheduler():
    scheduler.add_job(func=remove_expired_records, trigger="interval", minutes=1)
    scheduler.start()

def log_file_open(user_id, file_id):
    recent_file = RecentFiles.query.filter_by(user_id=user_id, file_id=file_id).first()

    if recent_file:
        recent_file.opened_at = datetime.utcnow()
    else:
        recent_file = RecentFiles(user_id=user_id, file_id=file_id, opened_at=datetime.utcnow())
        db.session.add(recent_file)

    db.session.commit()


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/get_files', methods=['GET'])
@login_required
def get_files():
    files = MetaData.query.filter_by(user_id=current_user.id).all()
    file_list = []

    for file in files:
        file_list.append({
            'id': file.id,
            'internal_url': file.internal_url,
            'description': file.description,
            'tags': file.tags,
            'file_size': file.file_size,
            'last_modified': file.last_modified
        })

    return jsonify(file_list)

@app.route("/check_file_exists", methods=["GET"])
@login_required
def check_file_exists():
    filename = request.args.get('filename')
    folderPath = request.args.get('folderPath')
    print(folderPath)
    if folderPath[0] != '/':
        folderPath = '/' + folderPath
    if folderPath[-1] != '/':
        folderPath = folderPath + '/'
    internal_file_path = f"{current_user.email}{folderPath}{filename}"

    existing_data = MetaData.query.filter_by(internal_url=internal_file_path).first()
    print(existing_data, internal_file_path)
    if existing_data:
        return jsonify({
            'exists': True,
            'encrypted_key': existing_data.encryption_key
        })
    else:
        return jsonify({
            'exists': False
        })

@app.route('/validate-password', methods=['GET'])
def validate_password():
    email = request.args.get('email', '').lower()
    password = request.args.get('password')
    user = User.query.filter_by(email=email).first()

    if user and user.password == password:
        return '', 200
    else:
        return '', 401

@app.route('/get_file_data/<int:post_id>', methods=['GET'])
@login_required
def get_file_data(post_id):
    metadata = MetaData.query.get(post_id)
    if metadata:
        log_file_open(current_user.id, post_id)
        bucket = storage.bucket()
        blob = bucket.blob(f'{metadata.internal_url}')

        temp_dir = tempfile.mkdtemp()
        download_path = os.path.join(temp_dir, os.path.basename(metadata.internal_url))
        blob.download_to_filename(download_path)
        
        with open(download_path, 'rb') as file:
            encrypted_file_data = file.read()
        c_user = User.query.get(metadata.user_id)
        encryption_key = metadata.encryption_key
        if c_user.id != current_user.id:
            encryption_key = SharedWithMe.query.filter_by(user_id = current_user.id, file_id = post_id).first().encryption_key
        
        os.remove(download_path)
        os.rmdir(temp_dir)
        x = metadata.internal_url
        response = {
            'success': True,
            'message': 'File data retrieved successfully.',
            'description': metadata.description,
            'tags': metadata.tags,
            'data_type': metadata.data_type,
            'hash_id': metadata.hash_id,
            'digital_signature': metadata.digital_signature,
            'encryption_key': encryption_key,
            'encrypted_file_data': encrypted_file_data.hex(),
            'public_key':'',
            'email':x.split('/')[0]
        }
        x = x.split('/')[2]
        if c_user.id != current_user.id:
            response['public_key'] =  c_user.public_key

        return jsonify(response)
    return jsonify({'error': 'Post not found or access denied'}), 404

@app.route('/get_folder_data/<path:identifier>', methods=['GET'])
@login_required
def get_folder_data(identifier):
    if not identifier:
        return jsonify({'success': False, 'message': 'Invalid folder identifier.'}), 400
    
    files_metadata = MetaData.query.filter(MetaData.internal_url.like(f"%/{identifier}%")).all()
    
    if not files_metadata:
        idf = '/'.join(identifier.split('/')[1:])
        files_metadata = MetaData.query.filter(MetaData.internal_url.like(f"%/{idf}%")).all()

    if not files_metadata:
        return jsonify({'success': False, 'message': 'No files found in the specified folder.'}), 404

    if any(file.user_id != current_user.id for file in files_metadata):
        return jsonify({'success': False, 'message': 'You are not authorized to share files that you do not own.'}), 403

    files_data = []
    for file in files_metadata:
        c_user = User.query.get(file.user_id)
        
        encryption_key = file.encryption_key
        if c_user.id != current_user.id:
            shared_data = SharedWithMe.query.filter_by(user_id=current_user.id, file_id=file.id).first()
            encryption_key = shared_data.encryption_key if shared_data else None

        files_data.append({
            'id': file.id,
            'description': file.description,
            'tags': file.tags,
            'data_type': file.data_type,
            'hash_id': file.hash_id,
            'digital_signature': file.digital_signature,
            'encryption_key': encryption_key,
            'public_key': c_user.public_key if c_user.id != current_user.id else '',
            'email': file.internal_url.split('/')[0],
            'file_size': file.file_size,
            'last_modified': file.last_modified
        })
    
    return jsonify({'success': True, 'files': files_data})

@app.route('/check_email', methods=['POST'])
def check_email():
    email = request.json.get('email').lower()
    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        return jsonify({'exists': True})
    return jsonify({'exists': False})

@app.route('/get_public_key/<int:uid>', methods=['GET'])
@login_required
def get_public_key(uid):
    public_key = User.query.filter_by(id = uid).first().public_key
    response = {'public_key': public_key}
    return jsonify(response)

@app.route('/home')
@login_required
def home():
    user_id = current_user.id
    user_files = MetaData.query.filter_by(user_id=user_id).all()
    user_files_dict = []

    for metadata in user_files:
        metadata_dict = {
            'id': metadata.id,
            'description': metadata.description,
            'tags': metadata.tags,
            'internal_url': metadata.internal_url,
            'file_size': metadata.file_size,
            'last_modified': metadata.last_modified
        }
        user_files_dict.append(metadata_dict)

    shared_files_list = SharedWithMe.query.filter_by(user_id=current_user.id).all()
    shared_files_dict = []

    if len(shared_files_list) > 0:
        metadata_list = []
        for shared in shared_files_list:
            md = MetaData.query.get(shared.file_id)
            if md is not None:
                metadata_list.append(md)

        for metadata in metadata_list:
            metadata_dict = {
                'id': metadata.id,
                'description': metadata.description,
                'tags': metadata.tags,
                'internal_url': f'/shared/{metadata.internal_url}',
                'file_size': metadata.file_size,
                'last_modified': metadata.last_modified
            }
            shared_files_dict.append(metadata_dict)

    metadata_list_dict = user_files_dict + shared_files_dict
    return render_template('home.html', metadata_list=metadata_list_dict, email=current_user.email)

@app.route('/search_files')
@login_required
def search_files():
    search_query = request.args.get('query', '').strip()
    results = []

    if search_query:
        try:
            owned_files = MetaData.query.filter(
                or_(
                    MetaData.description.ilike(f'%{search_query}%'),
                    MetaData.tags.ilike(f'%{search_query}%'),
                    MetaData.internal_url.ilike(f'%{search_query}%')
                ),
                MetaData.user_id == current_user.id
            ).all()

            shared_file_ids = [shared.file_id for shared in SharedWithMe.query.filter_by(user_id=current_user.id).all()]
            shared_files = MetaData.query.filter(
                MetaData.id.in_(shared_file_ids),
                or_(
                    MetaData.description.ilike(f'%{search_query}%'),
                    MetaData.tags.ilike(f'%{search_query}%'),
                    MetaData.internal_url.ilike(f'%{search_query}%')
                )
            ).all()

            all_files = owned_files + shared_files

            results = [metadata_item.to_dict() for metadata_item in all_files]
        except Exception as e:
            print(f"Error in search_files route: {e}", file=sys.stderr)

    return jsonify(results)

@app.route("/get_folders", methods=["GET"])
@login_required
def get_folders():
    search_query = request.args.get('query', '')
    bucket = storage.bucket()
    blobs = bucket.list_blobs(prefix=current_user.email + "/")
    
    folders = set()
    for blob in blobs:
        path_parts = blob.name.split('/')
        for i in range(1, len(path_parts)):
            folder_path = '/'.join(path_parts[:i])
            if folder_path.startswith(search_query):
                folders.add(folder_path)

    return jsonify(list(folders))

@app.route("/upload", methods=["GET", "POST"])
@login_required
def upload():
    if request.method == "POST":
        files = request.files.getlist('file')
        folderPath = request.form['folderPath']
        description = request.form['description']
        tags = request.form['tags']
        data_types = json.loads(request.form.get('data_types[]'))
        digital_signatures = json.loads(request.form.get('digital_signatures[]'))
        encrypted_keys = json.loads(request.form.get('encrypted_keys[]'))
        visibility = request.form.get('visibility')
        print(digital_signatures)
        if visibility:
            visibility = 'Public'
        else:
            visibility = 'Private'

        tags_list = [tag.strip() for tag in tags.split(',')]

        temp_dir = tempfile.mkdtemp()

        for index, file in enumerate(files):
            file_path = os.path.join(temp_dir, file.filename)
            file.save(file_path)

            if folderPath[0] != '/':
                folderPath = '/' + folderPath
            if folderPath[-1] != '/':
                folderPath = folderPath + '/'

            internal_file_path = f"{current_user.email}{folderPath}{file.filename}"
            bucket = storage.bucket()
            blob = bucket.blob(internal_file_path)
            blob.upload_from_filename(file_path)
            external_url = blob.public_url

            file_size = size(os.path.getsize(file_path))
            last_modified = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

            existing_data = MetaData.query.filter_by(internal_url=internal_file_path).first()
            if existing_data:
                existing_data.description = description
                existing_data.tags = ','.join(tags_list)
                existing_data.data_type = data_types[index]
                existing_data.digital_signature = digital_signatures[index]
                existing_data.encryption_key = encrypted_keys[index]
                existing_data.external_url = external_url
                existing_data.shared_type = visibility
                existing_data.file_size = file_size
                existing_data.last_modified = last_modified
                db.session.commit()
            else:
                user_data = MetaData(
                    user_id=current_user.id,
                    description=description,
                    tags=','.join(tags_list),
                    data_type=data_types[index],
                    digital_signature=digital_signatures[index],
                    encryption_key=encrypted_keys[index],
                    internal_url=internal_file_path,
                    external_url=external_url,
                    shared_type=visibility,
                    file_size=file_size,
                    last_modified=last_modified
                )
                db.session.add(user_data)
            db.session.commit()

            os.remove(file_path)

        os.rmdir(temp_dir)

        return redirect(url_for('home'))

    return render_template("upload.html", email=current_user.email)

@app.route('/view_post')
@login_required
def view_post():
    user_id = current_user.id
    metadata_list = MetaData.query.filter_by(user_id=user_id).all()
    metadata_list_dict = []

    bucket = storage.bucket()
    
    for metadata in metadata_list:
        metadata_dict = metadata.to_dict()
        internal_url = f'{metadata.internal_url}'
        display_url = '/'.join(internal_url.split('/')[1:])
        metadata_dict['internal_url'] = display_url
        
        blob = bucket.get_blob(internal_url)
        try:
            file_size = size(int(str(blob.size)))
            last_modified = str(blob.updated)
            if last_modified != 'Unknown':
                try:
                    last_modified = parser.parse(last_modified).strftime('%Y-%m-%d %H:%M:%S')
                except ValueError:
                    last_modified = 'Invalid format'
        except Exception as e:
            print(f"Error fetching blob details: {e}")
            file_size = 'Unknown'
            last_modified = 'Unknown'
        metadata_dict['file_size'] = file_size
        metadata_dict['last_modified'] = last_modified
        metadata_list_dict.append(metadata_dict)

    return render_template('view_post.html', metadata_list=metadata_list_dict)

@app.route('/access/<share_link>')
def access_shared_file(share_link):
    shared_file = SharedWithMe.query.filter_by(share_link=share_link).first_or_404()
    if shared_file.expiration_date < datetime.now():
        db.session.delete(shared_file)
        db.session.commit()
        return 'Link has expired', 403

    file = MetaData.query.get_or_404(shared_file.file_id)
    return render_template('file_view.html', file=file)

@app.route('/profile')
@login_required
def profile():
    user_data = {
        'first_name': current_user.first_name,
        'last_name': current_user.last_name,
        'email': current_user.email
    }
    return render_template('profile.html', user_data=user_data)

@app.route('/change_email', methods=['POST'])
@login_required
def change_email():
    new_email = request.form['new_email']
    existing_user = User.query.filter_by(email=new_email).first()
    if existing_user:
        flash('Email already in use.', 'error')
        print('Email already in use.', 'error')
        return redirect(url_for('profile'))

    current_user.email = new_email
    db.session.commit()
    flash('Email updated successfully.', 'success')
    return redirect(url_for('profile'))

@app.route('/change_password', methods=['POST'])
@login_required
def change_password():
    current_password = request.form['current_password']
    new_password = request.form['new_password']
    confirm_new_password = request.form['confirm_new_password']

    if current_user.password != current_password:
        flash('Current password is incorrect.', 'error')
        return redirect(url_for('profile'))

    if new_password != confirm_new_password:
        flash('New passwords do not match.', 'error')
        return redirect(url_for('profile'))

    current_user.password = new_password
    db.session.commit()
    flash('Password updated successfully.', 'success')
    return redirect(url_for('profile'))

@app.route('/change_first_name', methods=['POST'])
@login_required
def change_first_name():
    new_first_name = request.form['new_first_name']

    if not new_first_name:
        flash('First name cannot be empty.', 'error')
        return redirect(url_for('profile'))

    current_user.first_name = new_first_name
    db.session.commit()
    flash('First name updated successfully.', 'success')
    return redirect(url_for('profile'))

@app.route('/change_last_name', methods=['POST'])
@login_required
def change_last_name():
    new_last_name = request.form['new_last_name']

    if not new_last_name:
        flash('Last name cannot be empty.', 'error')
        return redirect(url_for('profile'))

    current_user.last_name = new_last_name
    db.session.commit()
    flash('Last name updated successfully.', 'success')
    return redirect(url_for('profile'))

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        first_name = request.form['first_name']
        last_name = request.form['last_name']
        email = request.form['email'].lower()
        password = request.form['password']
        encrypted_public_key = request.form['public_key']

        new_user = User(first_name=first_name, last_name=last_name, email=email,
                        password=password, public_key=encrypted_public_key)

        db.session.add(new_user)
        db.session.commit()
        return jsonify({'success': True})
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form['email'].lower()
        password = request.form['password']
        public_key = request.form['public_key']
        user = User.query.filter_by(email=email).first()
        key_file_location = request.form['file_name']

        if user and user.password == password and public_key == user.public_key:
            login_user(user)
            session['key_file_path'] = key_file_location
            user_data = {'first_name': user.first_name, 'last_name': user.last_name,
                         'email': user.email, 'public_key': user.public_key}
            return redirect(url_for('home', user_data=user_data))
        else:
            return "Invalid email or password."
    return render_template('login.html')

@app.route('/my_files')
@login_required
def my_files():
    user_id = current_user.id
    
    user_files = MetaData.query.filter_by(user_id=user_id).all()
    user_files_dict = []

    for metadata in user_files:
        metadata_dict = {
            'id': metadata.id,
            'description': metadata.description,
            'tags': metadata.tags,
            'internal_url': '/'.join(metadata.internal_url.split('/')[1:]),
            'file_size': metadata.file_size,
            'last_modified': metadata.last_modified
        }
        user_files_dict.append(metadata_dict)

    return render_template('my_files.html', metadata_list=user_files_dict, email=current_user.email)


@app.route('/shared_with_me')
@login_required
def shared_with_me():
    shared_files_list = SharedWithMe.query.filter_by(user_id=current_user.id).all()
    shared_files_dict = []

    if len(shared_files_list) > 0:
        metadata_list = []
        for shared in shared_files_list:
            md = MetaData.query.get(shared.file_id)
            if md is not None:
                metadata_list.append(md)

        for metadata in metadata_list:

            metadata_dict = {
                'id': metadata.id,
                'description': metadata.description,
                'tags': metadata.tags,
                'internal_url': metadata.internal_url,
                'file_size': metadata.file_size,
                'last_modified': metadata.last_modified
            }
            shared_files_dict.append(metadata_dict)

    metadata_list_dict = shared_files_dict
    return render_template('shared_with_me.html', metadata_list=metadata_list_dict, email=current_user.email)

@app.route('/shared_by_me')
@login_required
def shared_by_me():
    user_id = current_user.id
    user_files = MetaData.query.filter_by(user_id=user_id).all()
    user_files_dict = []

    user_shared_data = SharedByMe.query.filter_by(owner_id=user_id).all()
    shared_files = [file.file_id for file in user_shared_data]

    for metadata in user_files:
        if metadata.id in shared_files:
            metadata_dict = {
                'id': metadata.id,
                'description': metadata.description,
                'tags': metadata.tags,
                'internal_url': metadata.internal_url,
                'file_size': metadata.file_size,
                'last_modified': metadata.last_modified
            }
            user_files_dict.append(metadata_dict)

    return render_template('shared_by_me.html', metadata_list=user_files_dict, email=current_user.email)

@app.route('/delete_post/<int:post_id>', methods=['GET', 'POST'])
@login_required
def delete_post(post_id):
    metadata = MetaData.query.get(post_id)

    if metadata:
        if metadata.user_id == current_user.id:
            
            try:
                
                bucket = storage.bucket()
                blob = bucket.blob(f'{metadata.internal_url}')
                blob.delete()
                
                
                db.session.delete(metadata)
                db.session.commit()
                flash('Post deleted successfully.', 'success')
            except:
                db.session.delete(metadata)
                db.session.commit()
                flash('Post metadata deleted successfully.', 'success')
        else:
            
            shared_with_me = SharedWithMe.query.filter_by(user_id=current_user.id, file_id=post_id).first()
            if shared_with_me:
                
                
                shared_by_me = SharedByMe.query.filter_by(file_id=post_id, shared_with_user_id=current_user.id).first()
                if shared_by_me:
                    db.session.delete(shared_by_me)
                db.session.delete(shared_with_me)
                db.session.commit()
                flash('Access to the shared post removed successfully.', 'success')
            else:
                flash('Access denied or post not found.', 'error')
    else:
        flash('Post not found.', 'error')

    return redirect(url_for('home'))

@app.route('/delete_folder', methods=['GET'])
@login_required
def delete_folder():
    folder_path = request.args.get('folder_path')
    
    if not folder_path:
        flash('No folder path provided.', 'error')
        return redirect(url_for('home'))

    try:
        
        files_in_folder = MetaData.query.filter(MetaData.internal_url.like(f"%/{folder_path}/%")).all()
        if not files_in_folder:
            fp = '/'.join(folder_path.split('/')[1:])
            files_in_folder = MetaData.query.filter(MetaData.internal_url.like(f"%/{fp}/%")).all()
        if files_in_folder:
            for file in files_in_folder:
                if file.user_id == current_user.id:
                    
                    try:
                        
                        bucket = storage.bucket()
                        blob = bucket.blob(file.internal_url)
                        blob.delete()
                    except Exception as e:
                        print(f"Error deleting file from storage: {e}")
                        flash('Failed to delete files from storage.', 'error')
                        return redirect(url_for('home'))

                    db.session.delete(file)
                else:
                    
                    shared_with_me = SharedWithMe.query.filter_by(user_id=current_user.id, file_id=file.id).first()
                    print(shared_with_me,current_user.id, file.id)
                    if shared_with_me:
                        
                        shared_by_me = SharedByMe.query.filter_by(file_id=file.id, shared_with_user_id=current_user.id).first()
                        if shared_by_me:
                            db.session.delete(shared_by_me)
                        db.session.delete(shared_with_me)
                    else:
                        flash('You do not have permission to delete this folder.', 'error')
                        return redirect(url_for('home'))

            
            db.session.commit()
            flash('Folder deleted successfully.', 'success')
        else:
            flash('Folder not found or already deleted.', 'error')

    except Exception as e:
        flash(f'An error occurred: {str(e)}', 'error')

    return redirect(url_for('home'))


@app.route('/get_shared_users/<int:file_id>', methods=['GET'])
@login_required
def get_shared_users(file_id):
    
    shared_users = SharedByMe.query.filter_by(file_id=file_id, owner_id=current_user.id).all()
    users_list = []

    for shared in shared_users:
        user = User.query.get(shared.shared_with_user_id)
        if user:
            users_list.append({
                'user_id': user.id,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'email': user.email,
                'share_link': shared.share_link,
                'expiration_date': shared.expiration_date.strftime("%Y-%m-%d %H:%M:%S")
            })

    return jsonify(users_list)

@app.route('/extend_share/<int:file_id>/<int:user_id>', methods=['POST'])
@login_required
def extend_share(file_id, user_id):
    data = request.get_json()  
    days_to_add = data.get('days')
    print(days_to_add)
    if not days_to_add:
        return jsonify({'status': 'error', 'message': 'No days provided.'})

    try:
        days_to_add = int(days_to_add)
    except ValueError:
        return jsonify({'status': 'error', 'message': 'Invalid days format.'})

    
    shared = SharedByMe.query.filter_by(file_id=file_id, shared_with_user_id=user_id, owner_id=current_user.id).first()
    
    if shared:
        if shared.expiration_date < datetime.now():
            shared.expiration_date = datetime.now() + timedelta(days=days_to_add)
        else:
            shared.expiration_date += timedelta(days=days_to_add)
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Share expiration extended.'})
    else:
        return jsonify({'status': 'error', 'message': 'Share not found.'})

@app.route('/revoke_share/<int:file_id>/<int:user_id>', methods=['POST'])
@login_required
def revoke_share(file_id, user_id):
    shared = SharedByMe.query.filter_by(file_id=file_id, shared_with_user_id=user_id, owner_id=current_user.id).first()
    if shared:
        
        db.session.delete(shared)
        shared_with_me = SharedWithMe.query.filter_by(file_id=file_id, user_id=user_id).first()
        if shared_with_me:
            db.session.delete(shared_with_me)
        db.session.commit()
        return jsonify({'status': 'success'})
    else:
        return jsonify({'status': 'error'})

@app.route('/search_users', methods=['GET'])
@login_required
def search_users():
    query = request.args.get('query', '').lower()
    users = User.query.filter(
        (User.first_name.ilike(f'%{query}%')) |
        (User.last_name.ilike(f'%{query}%')) |
        (User.email.ilike(f'%{query}%'))
    ).all()
    user_list = []
    for user in users:
        if user.id != current_user.id:
            user_list += [{'id': user.id,'first_name': user.first_name, 'last_name': user.last_name, 'email': user.email, 'public_key':user.public_key}]
    return jsonify({'users': user_list})

@app.route('/share_post/<int:post_id>/<int:user_id>', methods=['POST'])
@login_required
def share_post(post_id, user_id):
    
    request_data = request.get_json()
    encryption_key = request_data.get('encryption_keys')
    encryption_key = encryption_key[0]
    days = int(request_data.get('days', 30))
    expiration_date = datetime.utcnow() + timedelta(days=days)

    
    file_metadata = MetaData.query.filter_by(id=post_id).first()
    if not file_metadata:
        return jsonify({'success': False, 'message': 'File metadata not found.'}), 404

    
    if file_metadata.user_id != current_user.id:
        flash('You do not have permission to share this post.', 'error')
        return jsonify({'success': False, 'message': 'You are not allowed to share this file.'}), 403

    
    requester = User.query.filter_by(id=user_id).first()
    if not requester:
        return jsonify({'success': False, 'message': 'User not found.'}), 404

    requester_email = requester.email
    current_email = current_user.email

    
    new_internal_url = f"{requester_email}/shared/{file_metadata.internal_url}"
    print(os.path.basename(file_metadata.internal_url))
    
    existing_shared_by_me = SharedByMe.query.filter_by(owner_id=current_user.id, file_id=post_id, shared_with_user_id=user_id).first()
    if existing_shared_by_me:
        
        existing_shared_by_me.share_link = f"/download/{new_internal_url}"
        existing_shared_by_me.expiration_date = expiration_date
    else:
        
        new_shared_by_me = SharedByMe(
            owner_id=current_user.id,
            file_id=post_id,
            shared_with_user_id=user_id,
            share_link=f"/download/{new_internal_url}",
            expiration_date=expiration_date
        )
        db.session.add(new_shared_by_me)

    
    existing_shared_with_me = SharedWithMe.query.filter_by(user_id=user_id, file_id=post_id).first()
    if existing_shared_with_me:
        
        existing_shared_with_me.share_link = f"/download/{new_internal_url}"
        existing_shared_with_me.expiration_date = expiration_date
        existing_shared_with_me.encryption_key = encryption_key
    else:
        
        new_shared_with_me = SharedWithMe(
            user_id=user_id,
            file_id=post_id,
            encryption_key=encryption_key,
            share_link=f"/download/{new_internal_url}",
            expiration_date=expiration_date
        )
        db.session.add(new_shared_with_me)

    
    db.session.commit()

    return jsonify({'success': True, 'message': 'Post shared sucessfully.'})

@app.route('/share_folder/<path:identifier>/<int:user_id>', methods=['POST'])
@login_required
def share_folder(identifier, user_id):
    request_data = request.get_json()
    encryption_keys = request_data.get('encryption_keys', [])
    days = int(request_data.get('days', 30))
    expiration_date = datetime.utcnow() + timedelta(days=days)
    print(len(encryption_keys),identifier)
    
    requester = User.query.filter_by(id=user_id).first()
    if not requester:
        return jsonify({'success': False, 'message': 'User not found.'}), 404

    files_metadata = MetaData.query.filter(MetaData.internal_url.like(f"%/{identifier}%")).all()
    if not files_metadata:
        return jsonify({'success': False, 'message': 'No files found in the specified folder.'}), 404

    for file_metadata, encryption_key in zip(files_metadata, encryption_keys):
        if file_metadata.user_id != current_user.id:
            return jsonify({'success': False, 'message': 'You do not have permission to share some files.'}), 403

        new_internal_url = f"{requester.email}/shared/{file_metadata.internal_url}"
        print(new_internal_url)
        existing_shared_by_me = SharedByMe.query.filter_by(owner_id=current_user.id, file_id=file_metadata.id, shared_with_user_id=user_id).first()
        if existing_shared_by_me:
            existing_shared_by_me.share_link = f"/download/{new_internal_url}"
            existing_shared_by_me.expiration_date = expiration_date
        else:
            new_shared_by_me = SharedByMe(
                owner_id=current_user.id,
                file_id=file_metadata.id,
                shared_with_user_id=user_id,
                share_link=f"/download/{new_internal_url}",
                expiration_date=expiration_date
            )
            db.session.add(new_shared_by_me)

        existing_shared_with_me = SharedWithMe.query.filter_by(user_id=user_id, file_id=file_metadata.id).first()
        if existing_shared_with_me:
            existing_shared_with_me.share_link = f"/download/{new_internal_url}"
            existing_shared_with_me.expiration_date = expiration_date
            existing_shared_with_me.encryption_key = encryption_key
        else:
            new_shared_with_me = SharedWithMe(
                user_id=user_id,
                file_id=file_metadata.id,
                encryption_key=encryption_key,
                share_link=f"/download/{new_internal_url}",
                expiration_date=expiration_date
            )
            db.session.add(new_shared_with_me)

    db.session.commit()

    return jsonify({'success': True, 'message': 'Folder shared sucessfully.'})

if __name__ == "__main__":
    create_db() 
    #download_db()
    app.run(debug=True)
